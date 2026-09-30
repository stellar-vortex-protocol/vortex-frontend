import {
  Address,
  FeeBumpTransaction,
  Networks,
  StrKey,
  TransactionBuilder,
  xdr,
} from "@stellar/stellar-sdk";

export class ContractVerificationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ContractVerificationError";
  }
}

/**
 * Returns the contract ID of the first contract invocation in a transaction
 * envelope (fee-bump envelopes are unwrapped). The network passphrase only
 * affects the hash, not the decoded operations, so any network works here.
 */
export function decodeContractIdFromXdr(xdrString: string): string {
  try {
    const parsed = TransactionBuilder.fromXDR(xdrString, Networks.TESTNET);
    const tx = parsed instanceof FeeBumpTransaction ? parsed.innerTransaction : parsed;

    for (const op of tx.operations) {
      if (op.type !== "invokeHostFunction") continue;
      if (op.func.switch() !== xdr.HostFunctionType.hostFunctionTypeInvokeContract()) continue;
      const contractId = Address.fromScAddress(op.func.invokeContract().contractAddress()).toString();
      if (StrKey.isValidContract(contractId)) return contractId;
    }

    throw new Error("No contract invocations found in transaction");
  } catch (err) {
    throw new Error(
      `Failed to decode XDR transaction: ${err instanceof Error ? err.message : String(err)}`
    );
  }
}

export function verifyContractAddresses(
  unsignedXdr: string,
  expectedContractAddresses: (string | null | undefined)[]
): void {
  const configuredAddresses = expectedContractAddresses.filter(
    (addr) => addr !== null && addr !== undefined
  );

  if (configuredAddresses.length === 0) {
    throw new ContractVerificationError(
      "No contract addresses configured. Set NEXT_PUBLIC_SETTLEMENT_CONTRACT and/or NEXT_PUBLIC_SOLVER_REGISTRY_CONTRACT environment variables."
    );
  }

  try {
    const decodedAddress = decodeContractIdFromXdr(unsignedXdr);

    if (!configuredAddresses.includes(decodedAddress)) {
      throw new ContractVerificationError(
        `Transaction targets contract ${decodedAddress}, but expected one of: ${configuredAddresses.join(", ")}`
      );
    }
  } catch (err) {
    if (err instanceof ContractVerificationError) {
      throw err;
    }
    throw new ContractVerificationError(
      `Failed to verify contract address: ${err instanceof Error ? err.message : String(err)}`
    );
  }
}
