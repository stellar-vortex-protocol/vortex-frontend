/**
 * The single definition of the app's environment variables (Issue #403).
 *
 * Plain data plus small validators, in a .mjs file so both the Node scripts
 * (scripts/check-env-vars.mjs, next.config.mjs) and the typed runtime module
 * (src/lib/config.ts) use exactly the same rules and defaults.
 *
 * To add a variable, see "Adding a new environment variable" in
 * docs/configuration.md.
 */

export const NETWORKS = /** @type {const} */ (["testnet", "futurenet", "mainnet"]);

const LOCAL_HOSTS = new Set(["localhost", "127.0.0.1", "[::1]"]);

/** @param {URL} url */
function isLocal(url) {
  return LOCAL_HOSTS.has(url.hostname);
}

/**
 * Builds a URL validator. In production only `secureProtocol` is accepted
 * for non-local hosts.
 * @param {string[]} protocols e.g. ["http:", "https:"]
 * @param {string} secureProtocol e.g. "https:"
 * @param {string} example
 */
export function urlValidator(protocols, secureProtocol, example) {
  /**
   * @param {string} value
   * @param {{ production: boolean }} ctx
   * @returns {string | null} an error message, or null when valid
   */
  return (value, { production }) => {
    let url;
    try {
      url = new URL(value);
    } catch {
      return `must be an absolute URL, e.g. ${example}`;
    }
    if (!protocols.includes(url.protocol)) {
      return `must use ${protocols.map((p) => `${p}//`).join(" or ")}, e.g. ${example}`;
    }
    if (production && url.protocol !== secureProtocol && !isLocal(url)) {
      return `must use ${secureProtocol}// in production (only localhost may use ${url.protocol}//)`;
    }
    return null;
  };
}

/** @param {string} value */
function networkValidator(value) {
  return /** @type {readonly string[]} */ (NETWORKS).includes(value)
    ? null
    : `must be one of ${NETWORKS.join(" | ")}`;
}

// Soroban contract strkey: "C" + 55 base32 characters (A-Z, 2-7).
const CONTRACT_ID_RE = /^C[A-Z2-7]{55}$/;

/** @param {string} value */
function contractIdValidator(value) {
  return CONTRACT_ID_RE.test(value)
    ? null
    : "must be a Soroban contract ID (56 characters starting with C), or empty until deployed";
}

/**
 * @typedef {object} EnvVar
 * @property {string} name
 * @property {string} key the property name on the exported config
 * @property {string} description
 * @property {string} example value written to .env.example
 * @property {string | null} default used when the variable is unset or empty
 * @property {boolean} allowEmpty when true an empty value is valid (and kept)
 * @property {(value: string, ctx: { production: boolean }) => string | null} validate
 */

/** @type {EnvVar[]} */
export const ENV_SCHEMA = [
  {
    name: "NEXT_PUBLIC_API_URL",
    key: "apiUrl",
    description: "URL of your running `vortex-backend` relay",
    example: "http://localhost:4000",
    default: "http://localhost:4000",
    allowEmpty: false,
    validate: urlValidator(["http:", "https:"], "https:", "https://relay.example.com"),
  },
  {
    name: "NEXT_PUBLIC_WS_URL",
    key: "wsUrl",
    description: "WebSocket URL of the relay (usually with `/ws` path); unset disables live updates",
    example: "ws://localhost:4000/ws",
    default: null,
    allowEmpty: false,
    validate: urlValidator(["ws:", "wss:"], "wss:", "wss://relay.example.com/ws"),
  },
  {
    name: "NEXT_PUBLIC_NETWORK",
    key: "network",
    description: "Stellar network: `testnet`, `futurenet`, or `mainnet`",
    example: "testnet",
    default: "testnet",
    allowEmpty: false,
    validate: networkValidator,
  },
  {
    name: "NEXT_PUBLIC_SETTLEMENT_CONTRACT",
    key: "settlementContract",
    description: "Settlement contract ID from `vortex-contract` deployment (empty until deployed)",
    example: "",
    default: "",
    allowEmpty: true,
    validate: contractIdValidator,
  },
  {
    name: "NEXT_PUBLIC_SOLVER_REGISTRY_CONTRACT",
    key: "solverRegistryContract",
    description: "Solver registry contract ID from `vortex-contract` deployment (empty until deployed)",
    example: "",
    default: "",
    allowEmpty: true,
    validate: contractIdValidator,
  },
  {
    name: "NEXT_PUBLIC_SITE_URL",
    key: "siteUrl",
    description: "Canonical site origin, used for absolute Open Graph / Twitter image URLs",
    example: "http://localhost:3000",
    default: "http://localhost:3000",
    allowEmpty: false,
    validate: urlValidator(["http:", "https:"], "https:", "https://vortex.example.com"),
  },
];

/**
 * Names of NEXT_PUBLIC_* variables that look like they hold secrets. Anything
 * NEXT_PUBLIC_* is inlined into the browser bundle.
 */
export const SUSPICIOUS_PATTERNS = [
  /secret/i,
  /key/i,
  /token/i,
  /password/i,
  /private/i,
  /api_?key/i,
  /bearer/i,
  /credential/i,
  /auth/i,
];

/**
 * Parses and validates raw environment values against ENV_SCHEMA.
 *
 * @param {Record<string, string | undefined>} env raw values by variable name
 * @param {{ production: boolean }} ctx
 * @returns {{ values: Record<string, string | null>, errors: string[] }}
 *   values keyed by `EnvVar.key`; errors name the variable and the expected format
 */
export function parseEnv(env, ctx) {
  /** @type {Record<string, string | null>} */
  const values = {};
  /** @type {string[]} */
  const errors = [];
  for (const variable of ENV_SCHEMA) {
    const raw = env[variable.name]?.trim() ?? "";
    if (raw === "") {
      values[variable.key] = variable.allowEmpty ? "" : variable.default;
      continue;
    }
    const error = variable.validate(raw, ctx);
    if (error) {
      errors.push(`${variable.name} ${error} (got "${raw}")`);
    }
    values[variable.key] = raw;
  }
  return { values, errors };
}
