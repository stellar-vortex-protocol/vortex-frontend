// Types the flag so it can be read with dot access, which Next inlines at build time.
declare global {
  namespace NodeJS {
    interface ProcessEnv {
      NEXT_PUBLIC_FEATURE_BOND_MGMT?: string;
    }
  }
}

export type BondFeatureMode = "off" | "live" | "mock";

export function bondFeatureMode(flag = process.env.NEXT_PUBLIC_FEATURE_BOND_MGMT): BondFeatureMode {
  if (flag === "mock") return "mock";
  if (flag === "1" || flag === "true") return "live";
  return "off";
}
