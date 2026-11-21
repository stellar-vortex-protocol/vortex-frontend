const HORIZON_URL = (process.env.NEXT_PUBLIC_HORIZON_URL ?? "https://horizon-testnet.stellar.org").replace(/\/$/, "");

export type { TrustlineState, TrustlineSnapshot } from "@/lib/chain/trustline";
export { clearTrustlineAccountCache, getTrustline, getTrustlineSnapshot } from "@/lib/chain/trustline";

export type ChainStatus ={ state: "confirmed" | "failed" | "not-found" | "unknown"; ledger?: number; resultCode?: string };
export interface ChainStatusProvider { getTransaction(hash: string, signal?: AbortSignal): Promise<ChainStatus>; }
export const horizonProvider: ChainStatusProvider = { async getTransaction(hash, signal) { if (!/^[a-f0-9]{64}$/i.test(hash)) return { state: "unknown" }; const response = await fetch(`${HORIZON_URL}/transactions/${hash}`, { signal }); if (response.status === 404) return { state: "not-found" }; if (!response.ok) return { state: "unknown" }; const data = await response.json() as { successful?: boolean; ledger?: number; result_codes?: { transaction?: string } }; return { state: data.successful ? "confirmed" : "failed", ledger: data.ledger, resultCode: data.result_codes?.transaction }; } };
