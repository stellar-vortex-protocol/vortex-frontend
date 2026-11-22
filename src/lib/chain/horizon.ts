import type { Token } from "@/lib/types";

const HORIZON_URL = (process.env.NEXT_PUBLIC_HORIZON_URL ?? "https://horizon-testnet.stellar.org").replace(/\/$/, "");

export type TrustlineState = "exists" | "missing" | "unknown";

/** Horizon answered with a non-2xx status. Carries the upstream status and raw body. */
export class HorizonError extends Error {
  readonly status: number;
  readonly body: string;
  constructor(status: number, body: string) {
    super(`Horizon responded ${status}`);
    this.name = "HorizonError";
    this.status = status;
    this.body = body;
  }
}

/** Horizon could not be reached or timed out (no HTTP response). */
export class HorizonUnavailableError extends Error {
  constructor(cause?: unknown) {
    super("Horizon request failed");
    this.name = "HorizonUnavailableError";
    this.cause = cause;
  }
}

/**
 * Fetches a Horizon account. Resolves with the parsed account on 2xx, throws
 * `HorizonError` (carrying the upstream status and raw body) on non-2xx, and
 * `HorizonUnavailableError` on network failure or timeout.
 */
export async function fetchHorizonAccount(
  address: string,
  fetchImpl: typeof fetch = fetch,
  horizonUrl: string = HORIZON_URL,
): Promise<unknown> {
  let response: Response;
  try {
    response = await fetchImpl(`${horizonUrl.replace(/\/$/, "")}/accounts/${encodeURIComponent(address)}`, {
      signal: AbortSignal.timeout(5_000),
      cache: "no-store",
    });
  } catch (error) {
    throw new HorizonUnavailableError(error);
  }
  if (!response.ok) {
    let body = "";
    try {
      body = await response.text();
    } catch {
      body = "";
    }
    throw new HorizonError(response.status, body);
  }
  return response.json();
}

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

export interface TrustlineSnapshot { state: TrustlineState; balance: string | null }

/** Trustline state plus the account's current balance (Horizon decimal string) for one asset. */
export async function getTrustlineSnapshot(address: string, asset: Token, fetchImpl: typeof fetch = fetch): Promise<TrustlineSnapshot> {
  const isNative = asset.symbol === "XLM" || asset.contract === "native";
  try {
    const response = await fetchImpl(`${HORIZON_URL}/accounts/${encodeURIComponent(address)}`);
    if (!response.ok) return { state: "unknown", balance: null };
    const account = await response.json();
    const entry = (account.balances ?? []).find((balance: { asset_type?: string; asset_code?: string; asset_issuer?: string }) => isNative ? balance.asset_type === "native" : balance.asset_code === asset.symbol && (!asset.issuer || balance.asset_issuer === asset.issuer));
    return entry ? { state: "exists", balance: entry.balance ?? null } : { state: "missing", balance: null };
  } catch { return { state: "unknown", balance: null }; }
}

export type ChainStatus ={ state: "confirmed" | "failed" | "not-found" | "unknown"; ledger?: number; resultCode?: string };
export interface ChainStatusProvider { getTransaction(hash: string, signal?: AbortSignal): Promise<ChainStatus>; }
export const horizonProvider: ChainStatusProvider = { async getTransaction(hash, signal) { if (!/^[a-f0-9]{64}$/i.test(hash)) return { state: "unknown" }; const response = await fetch(`${HORIZON_URL}/transactions/${hash}`, { signal }); if (response.status === 404) return { state: "not-found" }; if (!response.ok) return { state: "unknown" }; const data = await response.json() as { successful?: boolean; ledger?: number; result_codes?: { transaction?: string } }; return { state: data.successful ? "confirmed" : "failed", ledger: data.ledger, resultCode: data.result_codes?.transaction }; } };
