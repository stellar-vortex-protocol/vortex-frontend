import { Account, Asset, Networks, Operation, TransactionBuilder } from "@stellar/stellar-sdk";
import type { Token } from "@/lib/types";

const HORIZON_URL = (process.env.NEXT_PUBLIC_HORIZON_URL ?? "https://horizon-testnet.stellar.org").replace(/\/$/, "");
const ACCOUNT_CACHE_TTL_MS = 5_000;

interface CachedAccount { expiresAt: number; account: unknown }
const accountCache = new Map<string, CachedAccount>();

/** Clears the short-lived Horizon account cache (used by tests). */
export function clearTrustlineAccountCache(): void {
  accountCache.clear();
}

async function fetchAccount(address: string, fetchImpl: typeof fetch): Promise<unknown> {
  const cached = accountCache.get(address);
  if (cached && cached.expiresAt > Date.now()) return cached.account;
  const response = await fetchImpl(`${HORIZON_URL}/accounts/${encodeURIComponent(address)}`);
  if (!response.ok) throw new Error(`Horizon account lookup failed with status ${response.status}`);
  const account = await response.json();
  accountCache.set(address, { expiresAt: Date.now() + ACCOUNT_CACHE_TTL_MS, account });
  return account;
}

export type TrustlineState = "exists" | "missing" | "unknown";

export async function getTrustline(address: string, asset: Token, fetchImpl: typeof fetch = fetch): Promise<TrustlineState> {
  if (asset.symbol === "XLM" || asset.contract === "native") return "exists";
  try {
    const account = (await fetchAccount(address, fetchImpl)) as { balances?: { asset_code?: string; asset_issuer?: string }[] };
    return (account.balances ?? []).some((balance) => balance.asset_code === asset.symbol && (!asset.issuer || balance.asset_issuer === asset.issuer)) ? "exists" : "missing";
  } catch { return "unknown"; }
}

export interface TrustlineSnapshot { state: TrustlineState; balance: string | null }

/** Trustline state plus the account's current balance (Horizon decimal string) for one asset. */
export async function getTrustlineSnapshot(address: string, asset: Token, fetchImpl: typeof fetch = fetch): Promise<TrustlineSnapshot> {
  const isNative = asset.symbol === "XLM" || asset.contract === "native";
  try {
    const account = (await fetchAccount(address, fetchImpl)) as { balances?: { asset_type?: string; asset_code?: string; asset_issuer?: string; balance?: string }[] };
    const entry = (account.balances ?? []).find((balance) => isNative ? balance.asset_type === "native" : balance.asset_code === asset.symbol && (!asset.issuer || balance.asset_issuer === asset.issuer));
    return entry ? { state: "exists", balance: entry.balance ?? null } : { state: "missing", balance: null };
  } catch { return { state: "unknown", balance: null }; }
}

export function buildChangeTrustXdr(sourceAddress: string, asset: Token, network: "testnet" | "mainnet" = "testnet", fee = "100") {
  if (!asset.issuer) throw new Error("Asset issuer is required to add a trustline");
  const source = new Account(sourceAddress, "0");
  const passphrase = network === "mainnet" ? Networks.PUBLIC : Networks.TESTNET;
  return new TransactionBuilder(source, { fee, networkPassphrase: passphrase })
    .addOperation(Operation.changeTrust({ asset: new Asset(asset.symbol, asset.issuer) }))
    .setTimeout(300)
    .build()
    .toXDR();
}
