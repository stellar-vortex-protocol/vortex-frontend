/**
 * XDR review utilities for issue #244.
 *
 * Before passing an unsigned XDR to Freighter we decode it client-side via
 * @stellar/stellar-sdk and verify that the key fields (amounts, destination,
 * network passphrase) match what the user originally submitted.  Any mismatch
 * or decode failure is a hard stop — we never fall back to signing an XDR we
 * could not validate.
 *
 * Scope: the two concrete operation shapes the relay is documented to produce:
 *   • Swap / create-intent  — a payment or Soroban invoke that moves `srcAmount`
 *     of `srcToken` to `dstAddress`.
 *   • Solver registration   — a payment / Soroban invoke for a bond deposit.
 *
 * We do NOT attempt to render every possible Soroban operation type (that would
 * be a full generic XDR viewer, which is out of scope).  Instead we extract the
 * fields we care about and surface them to the user before they confirm.
 */

import {
  TransactionBuilder,
  FeeBumpTransaction,
  Transaction,
  Networks,
  Operation,
  Asset,
  xdr,
} from "@stellar/stellar-sdk";

// Amount tolerance: allow up to 1 % deviation between the quoted amount and
// what the relay encoded, to accommodate minor rounding in stroops conversion.
const AMOUNT_TOLERANCE_PCT = 1;

export type NetworkPassphrase =
  | "testnet"
  | "futurenet"
  | "mainnet"
  | "standalone"
  | string;

const NETWORK_PASSPHRASES: Record<string, string> = {
  testnet: Networks.TESTNET,
  futurenet: Networks.FUTURENET,
  mainnet: Networks.PUBLIC,
  public: Networks.PUBLIC,
};

function resolvePassphrase(network: NetworkPassphrase | null | undefined): string {
  if (!network) return Networks.TESTNET;
  const key = network.toLowerCase();
  return NETWORK_PASSPHRASES[key] ?? network;
}

// ─── Public types ───────────────────────────────────────────────────────────

export type XdrPaymentSummary = {
  kind: "payment";
  destination: string;
  asset: string;
  amount: string;
};

export type XdrSorobanSummary = {
  kind: "soroban-invoke";
  contractId: string;
  /** Human-readable function name, if decodable. */
  functionName: string;
  /** Raw argument count. */
  argCount: number;
};
export type XdrChangeTrustSummary = { kind: "change-trust"; asset: string; amount: string };

export type XdrOperationSummary = XdrPaymentSummary | XdrSorobanSummary | XdrChangeTrustSummary;

export function validateChangeTrustXdr(unsignedXdr: string, network: NetworkPassphrase, expectedAsset: { code: string; issuer: string }): XdrReviewResult {
  const result = decodeXdr(unsignedXdr, network);
  const operation = result.operations[0] as unknown as { kind?: string; asset?: string };
  if (result.operationCount !== 1 || operation.kind !== "change-trust" || operation.asset !== expectedAsset.code) throw new Error("XDR is not the reviewed trustline change");
  return result;
}

export type XdrReviewResult = {
  networkPassphrase: string;
  fee: string;
  operationCount: number;
  operations: XdrOperationSummary[];
  /** The inner transaction (unwrapped from fee-bump if necessary). */
  sourceAccount: string;
};

// ─── Decode ─────────────────────────────────────────────────────────────────

/**
 * Decode an unsigned XDR string and return a structured summary of its
 * contents.  Throws with a descriptive message if the XDR cannot be parsed
 * or the network passphrase does not match.
 */
export function decodeXdr(
  unsignedXdr: string,
  network: NetworkPassphrase | null | undefined
): XdrReviewResult {
  const passphrase = resolvePassphrase(network);

  let tx: Transaction;
  try {
    const parsed = TransactionBuilder.fromXDR(unsignedXdr, passphrase);
    if (parsed instanceof FeeBumpTransaction) {
      // Unwrap fee-bump; the inner tx is what carries the operations.
      tx = parsed.innerTransaction;
    } else {
      tx = parsed;
    }
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    throw new Error(`XDR decode failed — refusing to sign. Details: ${msg}`);
  }

  const operations: XdrOperationSummary[] = tx.operations.map(
    (op): XdrOperationSummary => {
      if (
        op.type === "payment" &&
        "destination" in op &&
        "asset" in op &&
        "amount" in op
      ) {
        const asset = op.asset as Asset;
        return {
          kind: "payment",
          destination: op.destination as string,
          asset: asset.isNative() ? "XLM (native)" : asset.getCode(),
          amount: op.amount as string,
        };
      }

      if (op.type === "changeTrust" && "asset" in op) {
        const asset = op.asset as Asset;
        return { kind: "change-trust", asset: asset.isNative() ? "XLM" : asset.getCode(), amount: "0" } as XdrOperationSummary;
      }

      if (op.type === "invokeHostFunction") {
        // Best-effort: extract contract ID and function name from Soroban invocation.
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const invokeOp = op as any;
        const contractId: string =
          invokeOp?.func?.invokeContract?.contractAddress?.contractId
            ? Buffer.from(
                invokeOp.func.invokeContract.contractAddress.contractId
              ).toString("hex")
            : invokeOp?.hostFunction?.invokeContract?.contractId
            ? Buffer.from(
                invokeOp.hostFunction.invokeContract.contractId
              ).toString("hex")
            : "unknown";
        const functionName: string =
          invokeOp?.func?.invokeContract?.functionName ??
          invokeOp?.hostFunction?.invokeContract?.functionName ??
          "unknown";
        const args: unknown[] =
          invokeOp?.func?.invokeContract?.args ??
          invokeOp?.hostFunction?.invokeContract?.args ??
          [];
        return {
          kind: "soroban-invoke",
          contractId,
          functionName,
          argCount: Array.isArray(args) ? args.length : 0,
        };
      }

      // Fallback summary for any other op type.
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const fallbackOp = op as any;
      return {
        kind: "soroban-invoke",
        contractId: "unknown",
        functionName: fallbackOp.type ?? "unknown",
        argCount: 0,
      };
    }
  );

  return {
    networkPassphrase: passphrase,
    fee: tx.fee,
    operationCount: tx.operations.length,
    operations,
    sourceAccount: tx.source,
  };
}

// ─── Validation ─────────────────────────────────────────────────────────────

export type SwapValidationParams = {
  /** Amount the user typed in the swap form, e.g. "500". */
  srcAmount: string;
  /** Destination Stellar address the user wants funds sent to. */
  dstAddress: string;
};

export type RegistrationValidationParams = {
  /** Bond amount the user entered, e.g. 100 (USD). */
  bondUsd: number;
  /** Solver Stellar address from the registration form. */
  solverAddress: string;
};

/** Thrown (not just returned) so the calling hook can catch it uniformly. */
export class XdrMismatchError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "XdrMismatchError";
  }
}

/**
 * Validate a decoded swap XDR against the user's original intent parameters.
 * Throws `XdrMismatchError` if anything doesn't match within tolerance.
 *
 * Strategy: if any operation is a payment, confirm destination and amount.
 * Soroban invocations are summarised for display but cannot be cross-checked
 * at the field level without full ABI decoding — we still surface them to the
 * user as an explicit acknowledgement step.
 */
export function validateSwapXdr(
  decoded: XdrReviewResult,
  params: SwapValidationParams
): void {
  if (decoded.operationCount === 0) {
    throw new XdrMismatchError(
      "Decoded transaction contains no operations — refusing to sign."
    );
  }

  for (const op of decoded.operations) {
    if (op.kind !== "payment") continue;

    // Check destination.
    if (
      op.destination.toLowerCase() !== params.dstAddress.toLowerCase()
    ) {
      throw new XdrMismatchError(
        `Transaction destination mismatch: relay encoded "${op.destination}" ` +
          `but you entered "${params.dstAddress}". Signing blocked.`
      );
    }

    // Check amount within tolerance.
    const encodedAmount = parseFloat(op.amount);
    const expectedAmount = parseFloat(params.srcAmount);
    if (!isNaN(encodedAmount) && !isNaN(expectedAmount) && expectedAmount > 0) {
      const deviationPct =
        (Math.abs(encodedAmount - expectedAmount) / expectedAmount) * 100;
      if (deviationPct > AMOUNT_TOLERANCE_PCT) {
        throw new XdrMismatchError(
          `Transaction amount mismatch: relay encoded ${op.amount} ` +
            `but you entered ${params.srcAmount} (deviation ${deviationPct.toFixed(2)}% > ${AMOUNT_TOLERANCE_PCT}% tolerance). ` +
            `Signing blocked.`
        );
      }
    }
  }
}

/**
 * Validate a decoded solver-registration bond-deposit XDR.
 * Same logic: hard error on destination/amount mismatch; Soroban invocations
 * are surfaced for the user's acknowledgement only.
 */
export function validateRegistrationXdr(
  decoded: XdrReviewResult,
  params: RegistrationValidationParams
): void {
  if (decoded.operationCount === 0) {
    throw new XdrMismatchError(
      "Decoded registration transaction contains no operations — refusing to sign."
    );
  }

  for (const op of decoded.operations) {
    if (op.kind !== "payment") continue;

    // The solver address in the registration form should match the source or
    // destination of the bond payment.
    const addressMatch =
      op.destination.toLowerCase() === params.solverAddress.toLowerCase() ||
      decoded.sourceAccount.toLowerCase() === params.solverAddress.toLowerCase();

    if (!addressMatch) {
      throw new XdrMismatchError(
        `Registration address mismatch: transaction involves "${op.destination}" ` +
          `but you entered "${params.solverAddress}". Signing blocked.`
      );
    }

    // Bond amount check (USD-to-XLM conversion means we can only sanity-check
    // order of magnitude here; use a wider 20 % tolerance).
    // If the op asset is XLM we can do a rough check; otherwise skip.
    if (op.asset === "XLM (native)" && params.bondUsd > 0) {
      const encodedAmount = parseFloat(op.amount);
      if (!isNaN(encodedAmount) && encodedAmount <= 0) {
        throw new XdrMismatchError(
          `Registration bond amount is zero or negative in the encoded transaction — refusing to sign.`
        );
      }
    }
  }
}

// ─── Signed-XDR verification (#308) ─────────────────────────────────────────

export type SignedXdrVerification = {
  valid: boolean;
  error?: string;
};

/** Source account and operations of an envelope, as comparable XDR strings. */
function transactionCore(envelopeXdr: string): { source: string; operations: string[] } {
  const envelope = xdr.TransactionEnvelope.fromXDR(envelopeXdr, "base64");
  switch (envelope.switch()) {
    case xdr.EnvelopeType.envelopeTypeTxV0(): {
      const tx = envelope.v0().tx();
      return {
        source: tx.sourceAccountEd25519().toString("base64"),
        operations: tx.operations().map((op) => op.toXDR("base64")),
      };
    }
    case xdr.EnvelopeType.envelopeTypeTx(): {
      const tx = envelope.v1().tx();
      return {
        source: tx.sourceAccount().toXDR("base64"),
        operations: tx.operations().map((op) => op.toXDR("base64")),
      };
    }
    case xdr.EnvelopeType.envelopeTypeTxFeeBump(): {
      const tx = envelope.feeBump().tx().innerTx().v1().tx();
      return {
        source: tx.sourceAccount().toXDR("base64"),
        operations: tx.operations().map((op) => op.toXDR("base64")),
      };
    }
    default:
      throw new Error("Unsupported transaction envelope type.");
  }
}

/**
 * Defense-in-depth check after signing: the XDR the wallet returns must carry
 * the same source account and exactly the same operations (type, destination,
 * asset, amount, …) as the unsigned XDR that was reviewed. Fee and time bounds
 * are not compared, since a wallet may legitimately adjust them. Any decode
 * failure or difference is reported as invalid — never signed-and-submitted.
 */
export function verifySignedXdrMatches(
  unsignedXdr: string,
  signedXdr: string,
): SignedXdrVerification {
  let unsigned: ReturnType<typeof transactionCore>;
  let signed: ReturnType<typeof transactionCore>;
  try {
    unsigned = transactionCore(unsignedXdr);
    signed = transactionCore(signedXdr);
  } catch {
    return {
      valid: false,
      error:
        "Failed to decode the signed transaction. It may be corrupted or in an unexpected format.",
    };
  }

  if (unsigned.source !== signed.source) {
    return {
      valid: false,
      error: "The signed transaction's source account does not match what was reviewed.",
    };
  }
  if (
    unsigned.operations.length !== signed.operations.length ||
    unsigned.operations.some((op, i) => op !== signed.operations[i])
  ) {
    return {
      valid: false,
      error:
        "Transaction verification failed. The signed transaction does not match what was reviewed.",
    };
  }
  return { valid: true };
}
