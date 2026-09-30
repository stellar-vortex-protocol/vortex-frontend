import { Account, Asset, Networks, Operation, TransactionBuilder } from "@stellar/stellar-sdk";
import type { Token } from "@/lib/types";

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
