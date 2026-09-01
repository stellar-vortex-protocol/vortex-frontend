import { TransactionBuilder, Networks, StrKey } from "@stellar/stellar-sdk";

export class ContractVerificationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ContractVerificationError";
  }
}

export function decodeContractIdFromXdr(xdrString: string): string {
  try {
    const envelope = TransactionBuilder.fromXDR(xdrString, Networks.TESTNET_NETWORK_PASSPHRASE);
    const operations = envelope.operations;

    const contractAddresses: string[] = [];

    for (const op of operations) {
      if (
        op.type === "invokeHostFunction" &&
        "hostFunction" in op &&
        op.hostFunction &&
        "type" in op.hostFunction &&
        op.hostFunction.type === "InvokeContractHostFunction"
      ) {
        const hostFn = op.hostFunction as any;
        if (hostFn.args && hostFn.args.length > 0) {
          const firstArg = hostFn.args[0];
          if (
            firstArg &&
            typeof firstArg === "object" &&
            "contractId" in firstArg &&
            firstArg.contractId
          ) {
            const contractId = firstArg.contractId as string;
            if (StrKey.isContractId(contractId)) {
              contractAddresses.push(contractId);
            }
          }
        }
      }
    }

    if (contractAddresses.length === 0) {
      throw new Error("No contract invocations found in transaction");
    }

    return contractAddresses[0];
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
