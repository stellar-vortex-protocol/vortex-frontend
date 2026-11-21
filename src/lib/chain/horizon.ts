import type { Token } from "@/lib/types";
import { lookupTrustline } from "@/lib/chain/trustline";

const HORIZON_URL = (process.env.NEXT_PUBLIC_HORIZON_URL ?? "https://horizon-testnet.stellar.org").replace(/\/$/, "");

export type TrustlineState = "exists" | "missing" | "unknown";

export async function getTrustline(address: string, asset: Token, fetchImpl: typeof fetch = fetch): Promise<TrustlineState> {
  const result = await lookupTrustline(address, asset, fetchImpl);
  if (result.status === "present") return "exists";
  if (result.status === "absent") return "missing";
  return "unknown";
}

export interface TrustlineSnapshot { state: TrustlineState; balance: string | null }

/** Trustline state plus the account's current balance (Horizon decimal string) for one asset. */
export async function getTrustlineSnapshot(address: string, asset: Token, fetchImpl: typeof fetch = fetch): Promise<TrustlineSnapshot> {
  const result = await lookupTrustline(address, asset, fetchImpl);
  if (result.status === "present") return { state: "exists", balance: result.balance };
  if (result.status === "absent") return { state: "missing", balance: null };
  return { state: "unknown", balance: null };
}

export type ChainStatus ={ state: "confirmed" | "failed" | "not-found" | "unknown"; ledger?: number; resultCode?: string };
export interface ChainStatusProvider { getTransaction(hash: string, signal?: AbortSignal): Promise<ChainStatus>; }
export const horizonProvider: ChainStatusProvider = { async getTransaction(hash, signal) { if (!/^[a-f0-9]{64}$/i.test(hash)) return { state: "unknown" }; const response = await fetch(`${HORIZON_URL}/transactions/${hash}`, { signal }); if (response.status === 404) return { state: "not-found" }; if (!response.ok) return { state: "unknown" }; const data = await response.json() as { successful?: boolean; ledger?: number; result_codes?: { transaction?: string } }; return { state: data.successful ? "confirmed" : "failed", ledger: data.ledger, resultCode: data.result_codes?.transaction }; } };
