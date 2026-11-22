import { Account, Asset, Networks, Operation, TransactionBuilder } from "@stellar/stellar-sdk";
import type { Token } from "@/lib/types";

const HORIZON_URL = (process.env.NEXT_PUBLIC_HORIZON_URL ?? "https://horizon-testnet.stellar.org").replace(/\/$/, "");

/**
 * Discriminated outcome of a trustline lookup.
 * - `present`: the account holds a trustline for the asset.
 * - `absent`: Horizon answered and the trustline is not there (safe to prompt "add trustline").
 * - `error`: the lookup itself failed (network/Horizon unreachable, bad response) — retryable.
 */
export type TrustlineLookup =
  | { status: "present"; balance: string | null }
  | { status: "absent" }
  | { status: "error"; message: string };

/** Look up whether `address` holds a trustline for `asset`, distinguishing failure from absence. */
export async function checkTrustline(address: string, asset: Token, fetchImpl: typeof fetch = fetch): Promise<TrustlineLookup> {
  const isNative = asset.symbol === "XLM" || asset.contract === "native";
  try {
    const response = await fetchImpl(`${HORIZON_URL}/accounts/${encodeURIComponent(address)}`);
    if (!response.ok) return { status: "error", message: `Horizon responded ${response.status}` };
    const account = (await response.json()) as {
      balances?: { asset_type?: string; asset_code?: string; asset_issuer?: string; balance?: string }[];
    };
    const entry = (account.balances ?? []).find((balance) =>
      isNative
        ? balance.asset_type === "native"
        : balance.asset_code === asset.symbol && (!asset.issuer || balance.asset_issuer === asset.issuer),
    );
    return entry ? { status: "present", balance: entry.balance ?? null } : { status: "absent" };
  } catch (error) {
    return { status: "error", message: error instanceof Error ? error.message : "Trustline lookup failed" };
  }
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
