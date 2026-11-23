/**
 * Per-environment expectations (config/environments/*.json) and the
 * cross-field invariants a whole environment map must satisfy. The manifests
 * hold rules only, never secret values. Used by scripts/check-env-vars.mjs.
 *
 * This module is the source of truth for the required keys: `npm run check:env`
 * validates a local environment against these rules. See docs/configuration.md
 * for the contributor-facing explanation, .env.example for the file to copy
 * from, and config/environments/*.json for the per-environment manifests
 * (which may differ between environments).
 */

import { ENV_SCHEMA, NETWORKS } from "../src/lib/env-schema.mjs";

export const ENVIRONMENTS = ["development", "preview", "production"];

const SCHEMA_NAMES = ENV_SCHEMA.map((v) => v.name);
const URL_VARS = ["NEXT_PUBLIC_API_URL", "NEXT_PUBLIC_WS_URL", "NEXT_PUBLIC_SITE_URL"];
const SECURE_PROTOCOLS = new Set(["https:", "wss:"]);
const LOCAL_HOSTS = new Set(["localhost", "127.0.0.1", "[::1]"]);

function parseUrl(raw) {
  try {
    return new URL(raw);
  } catch {
    return null;
  }
}

function isLocal(url) {
  return LOCAL_HOSTS.has(url.hostname);
}

/** Registrable-domain approximation: api.example.com and relay.example.com share "example.com". */
function domainOf(url) {
  return isLocal(url) ? "localhost" : url.hostname.split(".").slice(-2).join(".");
}

/** Problems with the manifests themselves: missing files, typos, unknown names. */
export function checkManifests(manifests) {
  const errors = [];
  for (const name of ENVIRONMENTS) {
    const manifest = manifests[name];
    const file = `config/environments/${name}.json`;
    if (!manifest) {
      errors.push(`${file} is missing`);
      continue;
    }
    if (manifest.environment !== name) {
      errors.push(`${file} declares environment "${manifest.environment}"`);
    }
    for (const variable of manifest.requiredVars) {
      if (!SCHEMA_NAMES.includes(variable)) {
        errors.push(`${file} requires ${variable}, which src/lib/env-schema.mjs doesn't define`);
      }
    }
    for (const network of manifest.networks) {
      if (!NETWORKS.includes(network)) {
        errors.push(`${file} allows network "${network}", which src/lib/env-schema.mjs doesn't define`);
      }
    }
  }
  return errors;
}

/**
 * Checks a raw environment map against one environment's manifest.
 * Malformed individual values are left to the schema (parseEnv); this only
 * reports what the environment expects and the cross-field rules.
 *
 * @param {object} manifest one of config/environments/*.json
 * @param {Record<string, string | undefined>} env raw values by variable name
 * @returns {string[]} problems, each naming the variable(s) involved
 */
export function checkEnvironment(manifest, env) {
  const { environment, requiredVars, networks, allowLocalhost, requireHttps } = manifest;
  const errors = [];
  const raw = (name) => env[name]?.trim() ?? "";

  for (const name of requiredVars) {
    if (raw(name) === "") errors.push(`${name} must be set in ${environment}`);
  }

  const network = raw("NEXT_PUBLIC_NETWORK");
  if (network && !networks.includes(network)) {
    errors.push(
      `NEXT_PUBLIC_NETWORK "${network}" is not allowed in ${environment} (use ${networks.join(" | ")})`,
    );
  }

  // mainnet is always secure and remote, whatever the environment says.
  const mainnet = network === "mainnet";
  const scope = mainnet ? "mainnet" : environment;
  const urls = {};
  for (const name of URL_VARS) {
    const url = parseUrl(raw(name));
    if (!url) continue;
    urls[name] = url;
    if ((requireHttps || mainnet) && !SECURE_PROTOCOLS.has(url.protocol)) {
      errors.push(`${name} must use https:// or wss:// on ${scope}`);
    }
    if ((!allowLocalhost || mainnet) && isLocal(url)) {
      errors.push(`${name} must not point at localhost on ${scope}`);
    }
  }

  const api = urls.NEXT_PUBLIC_API_URL;
  const ws = urls.NEXT_PUBLIC_WS_URL;
  if (api && ws && domainOf(api) !== domainOf(ws)) {
    errors.push(
      `NEXT_PUBLIC_WS_URL must be on the same domain as NEXT_PUBLIC_API_URL (${domainOf(ws)} vs ${domainOf(api)})`,
    );
  }

  const settlement = raw("NEXT_PUBLIC_SETTLEMENT_CONTRACT");
  if (settlement && settlement === raw("NEXT_PUBLIC_SOLVER_REGISTRY_CONTRACT")) {
    errors.push("NEXT_PUBLIC_SETTLEMENT_CONTRACT and NEXT_PUBLIC_SOLVER_REGISTRY_CONTRACT must differ");
  }

  return errors;
}
