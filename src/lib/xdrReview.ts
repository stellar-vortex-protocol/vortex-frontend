/**
 * XDR structural integrity verification for defense-in-depth against
 * compromised extensions or man-in-the-middle attacks on the postMessage bridge.
 *
 * This module provides utilities to decode and verify that a signed XDR
 * transaction still represents the same transaction that was reviewed and signed.
 */

import { Keypair, TransactionBuilder, xdr } from "@stellar/stellar-sdk";

export interface XdrReviewResult {
  valid: boolean;
  error?: string;
}

/**
 * Decode a base64-encoded XDR transaction and extract key fields.
 * Used to verify that signed XDR matches the original unsigned XDR.
 */
export function decodeTransactionXdr(xdrString: string) {
  try {
    const buffer = Buffer.from(xdrString, "base64");
    const envelope = xdr.TransactionEnvelope.fromXDR(buffer);

    // Extract transaction from envelope (handle both v1 and v2)
    let tx: xdr.Transaction | xdr.TransactionExt;
    if (envelope.switch() === xdr.EnvelopeTypeXdr.txTypeEnvelope()) {
      tx = envelope.v1()!.tx();
    } else if (envelope.switch() === xdr.EnvelopeTypeXdr.txTypeFeeBump()) {
      tx = envelope.feeBump()!.tx().innerTx().tx();
    } else {
      return null;
    }

    // Extract operations and other key fields
    const operations = tx.operations();
    return {
      envelope,
      transaction: tx,
      operationCount: operations.length,
      operations,
      sourceAccount: tx.sourceAccount().accountId().ed25519().toString("hex"),
    };
  } catch (err) {
    return null;
  }
}

/**
 * Verify that a signed XDR transaction matches the key fields of an unsigned XDR.
 * This check ensures that between review and signature, no critical operations were altered.
 *
 * @param unsignedXdr The original XDR sent for signing
 * @param signedXdr The XDR returned after signing
 * @returns { valid: true } if verification passes, { valid: false, error: "message" } if it fails
 */
export function verifySignedXdrMatches(unsignedXdr: string, signedXdr: string): XdrReviewResult {
  try {
    const unsignedDecoded = decodeTransactionXdr(unsignedXdr);
    const signedDecoded = decodeTransactionXdr(signedXdr);

    if (!unsignedDecoded || !signedDecoded) {
      return {
        valid: false,
        error:
          "Failed to decode transaction XDR. The signed transaction may be corrupted or in an unexpected format.",
      };
    }

    // Verify operation count matches
    if (unsignedDecoded.operationCount !== signedDecoded.operationCount) {
      return {
        valid: false,
        error: `Operation count mismatch: unsigned had ${unsignedDecoded.operationCount} operations, signed has ${signedDecoded.operationCount}. This may indicate a compromised extension or man-in-the-middle attack.`,
      };
    }

    // Verify source account matches
    if (unsignedDecoded.sourceAccount !== signedDecoded.sourceAccount) {
      return {
        valid: false,
        error: "Source account mismatch between unsigned and signed XDR. This may indicate a compromised extension.",
      };
    }

    // Verify each operation's key fields
    for (let i = 0; i < unsignedDecoded.operationCount; i++) {
      const unsignedOp = unsignedDecoded.operations[i];
      const signedOp = signedDecoded.operations[i];

      // Verify operation type
      if (unsignedOp.body().switch().value !== signedOp.body().switch().value) {
        return {
          valid: false,
          error: `Operation ${i}: type mismatch. Unsigned: ${unsignedOp.body().switch().value}, Signed: ${signedOp.body().switch().value}. This may indicate a malicious modification.`,
        };
      }

      // Verify operation destination and amount for payment-like operations
      if (isPaymentOperation(unsignedOp) && isPaymentOperation(signedOp)) {
        const unsignedPayment = unsignedOp.body().paymentOp()!;
        const signedPayment = signedOp.body().paymentOp()!;

        // Check destination
        const unsignedDest = unsignedPayment.destination().accountId().ed25519().toString("hex");
        const signedDest = signedPayment.destination().accountId().ed25519().toString("hex");
        if (unsignedDest !== signedDest) {
          return {
            valid: false,
            error: `Operation ${i}: payment destination changed during signing. This is a critical indicator of a compromised extension or man-in-the-middle attack.`,
          };
        }

        // Check amount
        if (unsignedPayment.amount() !== signedPayment.amount()) {
          return {
            valid: false,
            error: `Operation ${i}: payment amount changed during signing. This is a critical indicator of a compromised extension or man-in-the-middle attack.`,
          };
        }

        // Check asset
        const unsignedAsset = unsignedPayment.asset().toXDR("base64");
        const signedAsset = signedPayment.asset().toXDR("base64");
        if (unsignedAsset !== signedAsset) {
          return {
            valid: false,
            error: `Operation ${i}: payment asset changed during signing. This is a critical indicator of a compromised extension or man-in-the-middle attack.`,
          };
        }
      }

      // Verify invoke host function for contract calls
      if (isInvokeHostFunctionOperation(unsignedOp) && isInvokeHostFunctionOperation(signedOp)) {
        const unsignedInvoke = unsignedOp.body().invokeHostFunctionOp()!;
        const signedInvoke = signedOp.body().invokeHostFunctionOp()!;

        // Compare the host function XDR to detect structural changes
        const unsignedFunctionXdr = unsignedInvoke.hostFunction().toXDR("base64");
        const signedFunctionXdr = signedInvoke.hostFunction().toXDR("base64");

        if (unsignedFunctionXdr !== signedFunctionXdr) {
          return {
            valid: false,
            error: `Operation ${i}: contract invocation details changed during signing. This is a critical indicator of a compromised extension or man-in-the-middle attack.`,
          };
        }
      }
    }

    return { valid: true };
  } catch (err) {
    const errorMessage = err instanceof Error ? err.message : String(err);
    return {
      valid: false,
      error: `XDR verification failed with an unexpected error: ${errorMessage}. This may indicate a malformed transaction or a system issue.`,
    };
  }
}

function isPaymentOperation(op: xdr.Operation): boolean {
  return op.body().switch().value === xdr.OperationType.payment().value;
}

function isInvokeHostFunctionOperation(op: xdr.Operation): boolean {
  return op.body().switch().value === xdr.OperationType.invokeHostFunction().value;
}
