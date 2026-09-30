/**
 * Typed runtime configuration (Issue #403).
 *
 * The only module (besides next.config.mjs) that reads `process.env`; an
 * ESLint rule enforces this. Rules and defaults come from ./env-schema.mjs,
 * which the build-time checks use too.
 */
import { NETWORKS, parseEnv } from "./env-schema.mjs";

export type StellarNetwork = (typeof NETWORKS)[number];

export type AppConfig = Readonly<{
  apiUrl: string;
  wsUrl: string | null;
  network: StellarNetwork;
  settlementContract: string;
  solverRegistryContract: string;
  siteUrl: string;
}>;

export type RawEnv = Record<string, string | undefined>;

/**
 * Parses raw environment values into an `AppConfig`, throwing one error that
 * lists every invalid variable with its expected format.
 */
export function loadConfig(env: RawEnv, production: boolean): AppConfig {
  const { values, errors } = parseEnv(env, { production });
  if (errors.length > 0) {
    throw new Error(`Invalid environment configuration:\n  - ${errors.join("\n  - ")}`);
  }
  const text = (key: string): string => values[key] ?? "";
  return Object.freeze({
    apiUrl: text("apiUrl").replace(/\/$/, ""),
    wsUrl: values["wsUrl"] ?? null,
    // parseEnv has validated the network against NETWORKS.
    network: text("network") as StellarNetwork,
    settlementContract: text("settlementContract"),
    solverRegistryContract: text("solverRegistryContract"),
    siteUrl: text("siteUrl").replace(/\/$/, ""),
  });
}

// NEXT_PUBLIC_* values are inlined at build time only when read by their
// literal name, so each one is listed explicitly.
export const config: AppConfig = loadConfig(
  {
    NEXT_PUBLIC_API_URL: process.env["NEXT_PUBLIC_API_URL"],
    NEXT_PUBLIC_WS_URL: process.env["NEXT_PUBLIC_WS_URL"],
    NEXT_PUBLIC_NETWORK: process.env["NEXT_PUBLIC_NETWORK"],
    NEXT_PUBLIC_SETTLEMENT_CONTRACT: process.env["NEXT_PUBLIC_SETTLEMENT_CONTRACT"],
    NEXT_PUBLIC_SOLVER_REGISTRY_CONTRACT: process.env["NEXT_PUBLIC_SOLVER_REGISTRY_CONTRACT"],
    NEXT_PUBLIC_SITE_URL: process.env["NEXT_PUBLIC_SITE_URL"],
  },
  process.env.NODE_ENV === "production",
);
