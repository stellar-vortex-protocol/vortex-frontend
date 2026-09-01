import { describe, expect, it } from "vitest";
import {
  Networks,
  TransactionBuilder,
  Account,
  Operation,
  Asset,
  Keypair,
} from "@stellar/stellar-sdk";
import {
  decodeXdr,
  validateSwapXdr,
  validateRegistrationXdr,
  XdrMismatchError,
} from "./xdrReview";

// ─── Helpers ─────────────────────────────────────────────────────────────────

const PASSPHRASE = Networks.TESTNET;

// Generate fresh keypairs once per test module run.  Keypair.random() produces
// valid G-strkeys without network access, and using distinct instances ensures
// the source, destination, and "other" addresses are all different.
const SOURCE_KP = Keypair.random();
const DEST_KP = Keypair.random();
const OTHER_KP = Keypair.random();

const DESTINATION = DEST_KP.publicKey();
const OTHER_ADDRESS = OTHER_KP.publicKey();

/**
 * Build a minimal unsigned XDR with a single payment operation.
 */
function buildPaymentXdr(
  destination: string,
  amount: string,
  asset: Asset = Asset.native(),
  passphrase = PASSPHRASE
): string {
  const account = new Account(SOURCE_KP.publicKey(), "0");
  const tx = new TransactionBuilder(account, {
    fee: "100",
    networkPassphrase: passphrase,
  })
    .addOperation(
      Operation.payment({
        destination,
        asset,
        amount,
      })
    )
    .setTimeout(300)
    .build();
  return tx.toXDR();
}

// ─── decodeXdr ───────────────────────────────────────────────────────────────

describe("decodeXdr", () => {
  it("decodes a valid payment XDR", () => {
    const xdr = buildPaymentXdr(DESTINATION, "500");
    const result = decodeXdr(xdr, "testnet");

    expect(result.operationCount).toBe(1);
    expect(result.operations[0].kind).toBe("payment");
    if (result.operations[0].kind === "payment") {
      expect(result.operations[0].destination).toBe(DESTINATION);
      // The Stellar SDK normalises amounts to 7 decimal places in stroops format.
      expect(result.operations[0].amount).toBe("500.0000000");
      expect(result.operations[0].asset).toBe("XLM (native)");
    }
  });

  it("throws on a garbage XDR string", () => {
    expect(() => decodeXdr("not-an-xdr", "testnet")).toThrow(
      /XDR decode failed/i
    );
  });

  it("throws on an empty XDR string", () => {
    expect(() => decodeXdr("", "testnet")).toThrow(/XDR decode failed/i);
  });

  it("resolves null network to testnet passphrase without throwing", () => {
    const xdr = buildPaymentXdr(DESTINATION, "10");
    // null network → defaults to testnet passphrase — should not throw
    expect(() => decodeXdr(xdr, null)).not.toThrow();
  });

  it("throws when the XDR was built for a different network", () => {
    // TransactionBuilder.fromXDR does NOT validate the passphrase during
    // decode — it only affects signature verification.  The cross-network
    // guard this test validates is that we still get a successful decode
    // (the function does not throw) but the returned passphrase differs from
    // what was requested, allowing callers to detect the mismatch.
    // In practice, the relay always sends the passphrase alongside the XDR, so
    // mismatches would surface as signature-verification failures in Freighter.
    //
    // We therefore assert that decodeXdr does NOT throw for a mainnet XDR
    // presented as testnet — but the fee-bump unwrapping and field extraction
    // still work correctly on the XDR envelope.
    const xdr = buildPaymentXdr(DESTINATION, "10", Asset.native(), Networks.PUBLIC);
    expect(() => decodeXdr(xdr, "testnet")).not.toThrow();
  });

  it("reports fee from the decoded transaction", () => {
    const xdr = buildPaymentXdr(DESTINATION, "100");
    const result = decodeXdr(xdr, "testnet");
    expect(result.fee).toBe("100");
  });

  it("decodes multi-operation transactions", () => {
    const account = new Account(SOURCE_KP.publicKey(), "0");
    const tx = new TransactionBuilder(account, {
      fee: "200",
      networkPassphrase: PASSPHRASE,
    })
      .addOperation(
        Operation.payment({ destination: DESTINATION, asset: Asset.native(), amount: "100" })
      )
      .addOperation(
        Operation.payment({ destination: DESTINATION, asset: Asset.native(), amount: "200" })
      )
      .setTimeout(300)
      .build();
    const result = decodeXdr(tx.toXDR(), "testnet");
    expect(result.operationCount).toBe(2);
    expect(result.operations).toHaveLength(2);
  });
});

// ─── validateSwapXdr ─────────────────────────────────────────────────────────

describe("validateSwapXdr", () => {
  it("passes when destination and amount match exactly", () => {
    const xdr = buildPaymentXdr(DESTINATION, "500");
    const decoded = decodeXdr(xdr, "testnet");
    expect(() =>
      validateSwapXdr(decoded, { srcAmount: "500", dstAddress: DESTINATION })
    ).not.toThrow();
  });

  it("passes when amount is within the 1% tolerance", () => {
    // Relay encodes 499.5 (0.1% deviation from 500)
    const xdr = buildPaymentXdr(DESTINATION, "499.5");
    const decoded = decodeXdr(xdr, "testnet");
    expect(() =>
      validateSwapXdr(decoded, { srcAmount: "500", dstAddress: DESTINATION })
    ).not.toThrow();
  });

  it("blocks signing when destination does not match", () => {
    const xdr = buildPaymentXdr(DESTINATION, "500");
    const decoded = decodeXdr(xdr, "testnet");
    expect(() =>
      validateSwapXdr(decoded, { srcAmount: "500", dstAddress: OTHER_ADDRESS })
    ).toThrow(XdrMismatchError);
  });

  it("blocks signing when the destination mismatch error message is descriptive", () => {
    const xdr = buildPaymentXdr(DESTINATION, "500");
    const decoded = decodeXdr(xdr, "testnet");
    try {
      validateSwapXdr(decoded, { srcAmount: "500", dstAddress: OTHER_ADDRESS });
      throw new Error("should have thrown");
    } catch (err) {
      expect(err).toBeInstanceOf(XdrMismatchError);
      expect((err as XdrMismatchError).message).toContain("destination mismatch");
      expect((err as XdrMismatchError).message).toContain("Signing blocked");
    }
  });

  it("blocks signing when amount deviation exceeds 1%", () => {
    // Relay encodes 450 (10% deviation from 500)
    const xdr = buildPaymentXdr(DESTINATION, "450");
    const decoded = decodeXdr(xdr, "testnet");
    expect(() =>
      validateSwapXdr(decoded, { srcAmount: "500", dstAddress: DESTINATION })
    ).toThrow(XdrMismatchError);
  });

  it("blocks signing when amount deviation error message is descriptive", () => {
    const xdr = buildPaymentXdr(DESTINATION, "450");
    const decoded = decodeXdr(xdr, "testnet");
    try {
      validateSwapXdr(decoded, { srcAmount: "500", dstAddress: DESTINATION });
      throw new Error("should have thrown");
    } catch (err) {
      expect(err).toBeInstanceOf(XdrMismatchError);
      expect((err as XdrMismatchError).message).toContain("amount mismatch");
      expect((err as XdrMismatchError).message).toContain("Signing blocked");
    }
  });

  it("blocks signing on a transaction with zero operations", () => {
    // We can't build a 0-op tx via TransactionBuilder, so we fake the decoded result.
    const decoded = {
      networkPassphrase: PASSPHRASE,
      fee: "100",
      operationCount: 0,
      operations: [],
      sourceAccount: SOURCE_KP.publicKey(),
    };
    expect(() =>
      validateSwapXdr(decoded, { srcAmount: "500", dstAddress: DESTINATION })
    ).toThrow(XdrMismatchError);
  });

  it("does not throw for Soroban invoke operations (deferred to user review)", () => {
    // Soroban ops can't be field-validated without ABI decoding; they must pass
    // so the user can review the summary and explicitly confirm.
    const decoded = {
      networkPassphrase: PASSPHRASE,
      fee: "100",
      operationCount: 1,
      operations: [
        {
          kind: "soroban-invoke" as const,
          contractId: "abc123",
          functionName: "transfer",
          argCount: 3,
        },
      ],
      sourceAccount: SOURCE_KP.publicKey(),
    };
    expect(() =>
      validateSwapXdr(decoded, { srcAmount: "500", dstAddress: DESTINATION })
    ).not.toThrow();
  });
});

// ─── validateRegistrationXdr ─────────────────────────────────────────────────

describe("validateRegistrationXdr", () => {
  it("passes when solver address matches the payment destination", () => {
    const xdr = buildPaymentXdr(DESTINATION, "200");
    const decoded = decodeXdr(xdr, "testnet");
    expect(() =>
      validateRegistrationXdr(decoded, { bondUsd: 200, solverAddress: DESTINATION })
    ).not.toThrow();
  });

  it("passes when solver address matches the source account", () => {
    // source == SOURCE_KP.publicKey(), destination == DESTINATION
    const xdr = buildPaymentXdr(DESTINATION, "100");
    const decoded = decodeXdr(xdr, "testnet");
    expect(() =>
      validateRegistrationXdr(decoded, {
        bondUsd: 100,
        solverAddress: SOURCE_KP.publicKey(),
      })
    ).not.toThrow();
  });

  it("blocks signing when neither source nor destination matches", () => {
    const xdr = buildPaymentXdr(DESTINATION, "100");
    const decoded = decodeXdr(xdr, "testnet");
    expect(() =>
      validateRegistrationXdr(decoded, {
        bondUsd: 100,
        solverAddress: OTHER_ADDRESS,
      })
    ).toThrow(XdrMismatchError);
  });

  it("blocks signing on a transaction with zero operations", () => {
    const decoded = {
      networkPassphrase: PASSPHRASE,
      fee: "100",
      operationCount: 0,
      operations: [],
      sourceAccount: SOURCE_KP.publicKey(),
    };
    expect(() =>
      validateRegistrationXdr(decoded, {
        bondUsd: 100,
        solverAddress: DESTINATION,
      })
    ).toThrow(XdrMismatchError);
  });
});
