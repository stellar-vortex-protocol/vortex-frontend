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

export type ChainStatus = { state: "confirmed" | "failed" | "not-found" | "unknown"; ledger?: number; resultCode?: string };
export interface ChainStatusProvider { getTransaction(hash: string, signal?: AbortSignal): Promise<ChainStatus>; }
export const horizonProvider: ChainStatusProvider = { async getTransaction(hash, signal) { if (!/^[a-f0-9]{64}$/i.test(hash)) return { state: "unknown" }; const response = await fetch(`${HORIZON_URL}/transactions/${hash}`, { signal }); if (response.status === 404) return { state: "not-found" }; if (!response.ok) return { state: "unknown" }; const data = await response.json() as { successful?: boolean; ledger?: number; result_codes?: { transaction?: string } }; return { state: data.successful ? "confirmed" : "failed", ledger: data.ledger, resultCode: data.result_codes?.transaction }; } };
