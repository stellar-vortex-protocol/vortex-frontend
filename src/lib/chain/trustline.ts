import { Account, Asset, Networks, Operation, TransactionBuilder } from "@stellar/stellar-sdk";
import type { Token } from "@/lib/types";

const HORIZON_URL = (process.env.NEXT_PUBLIC_HORIZON_URL ?? "https://horizon-testnet.stellar.org").replace(/\/$/, "");

/** Discriminated trustline lookup outcome: present, absent, or the lookup itself failed. */
export type TrustlineLookup =
  | { status: "present"; balance: string | null }
  | { status: "absent" }
  | { status: "failed"; error: string };

/**
 * Look up whether `address` holds a trustline for `asset` on Horizon.
 * A 404 (unfunded account) means "absent"; network/HTTP/parse errors mean "failed"
 * so callers can render an error state instead of prompting to add a trustline.
 */
export async function lookupTrustline(
  address: string,
  asset: Token,
  fetchImpl: typeof fetch = fetch,
): Promise<TrustlineLookup> {
  if (asset.symbol === "XLM" || asset.contract === "native") return { status: "present", balance: null };
  let response: Response;
  try {
    response = await fetchImpl(`${HORIZON_URL}/accounts/${encodeURIComponent(address)}`);
  } catch (error) {
    return { status: "failed", error: error instanceof Error ? error.message : "Horizon request failed" };
  }
  if (response.status === 404) return { status: "absent" };
  if (!response.ok) return { status: "failed", error: `Horizon responded ${response.status}` };
  try {
    const account = (await response.json()) as {
      balances?: { asset_code?: string; asset_issuer?: string; balance?: string }[];
    };
    const entry = (account.balances ?? []).find(
      (balance) =>
        balance.asset_code === asset.symbol && (!asset.issuer || balance.asset_issuer === asset.issuer),
    );
    return entry ? { status: "present", balance: entry.balance ?? null } : { status: "absent" };
  } catch (error) {
    return { status: "failed", error: error instanceof Error ? error.message : "Malformed Horizon response" };
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
