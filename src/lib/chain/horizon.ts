import type { Token } from "@/lib/types";

const HORIZON_URL = (process.env.NEXT_PUBLIC_HORIZON_URL ?? "https://horizon-testnet.stellar.org").replace(/\/$/, "");

export type TrustlineState = "exists" | "missing" | "unknown";

export async function getTrustline(address: string, asset: Token, fetchImpl: typeof fetch = fetch): Promise<TrustlineState> {
  if (asset.symbol === "XLM" || asset.contract === "native") return "exists";
  try {
    const response = await fetchImpl(`${HORIZON_URL}/accounts/${encodeURIComponent(address)}`);
    if (response.status === 404) return "unknown";
    if (!response.ok) return "unknown";
    const account = await response.json();
    return (account.balances ?? []).some((balance: { asset_code?: string; asset_issuer?: string }) => balance.asset_code === asset.symbol && (!asset.issuer || balance.asset_issuer === asset.issuer)) ? "exists" : "missing";
  } catch { return "unknown"; }
}
