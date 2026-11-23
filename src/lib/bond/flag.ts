// Types the flag so it can be read with dot access, which Next inlines at build time.
declare global {
  namespace NodeJS {
    interface ProcessEnv {
      NEXT_PUBLIC_FEATURE_BOND_MGMT?: string;
    }
  }
}

export type BondFeatureMode = "off" | "live" | "mock";

/**
 * Feature flag gating the bond management UI.
 *
 * Env var: `NEXT_PUBLIC_FEATURE_BOND_MGMT`
 * Default: unset -> `"off"` (bond UI hidden).
 *
 * Accepted values:
 * - `"1"` or `"true"` -> `"live"` (real bond backend)
 * - `"mock"` -> `"mock"` (mock data, for local development)
 * - anything else / unset -> `"off"`
 *
 * To enable locally, set `NEXT_PUBLIC_FEATURE_BOND_MGMT=mock` (or `=1`) in
 * `.env.local` and restart the dev server. See `docs/bond-management.md`.
 */
export function bondFeatureMode(flag = process.env.NEXT_PUBLIC_FEATURE_BOND_MGMT): BondFeatureMode {
  if (flag === "mock") return "mock";
  if (flag === "1" || flag === "true") return "live";
  return "off";
}
