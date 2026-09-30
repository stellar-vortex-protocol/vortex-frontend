import { describe, expect, it } from "vitest";
import fc from "fast-check";
import {
  arbitraryValidStellarAddress,
  arbitraryCorruptedStellarAddress,
  arbitraryCorruptedChecksumAddress,
  arbitraryWrongLengthAddress,
  getNumRuns,
  getSeed,
  assertWithCorpus,
  loadCorpusEntries,
} from "../test/arbitraries";
import { isValidStellarPublicKey } from "./stellarAddress";
import { StrKey } from "@stellar/stellar-sdk";

// ─── Fuzz properties ──────────────────────────

describe("isValidStellarPublicKey — fuzz properties", () => {
  const numRuns = getNumRuns();
  const seed = getSeed();

  it("agrees with the SDK's StrKey.isValidEd25519PublicKey on all inputs", () => {
    assertWithCorpus(
      "matches-sdk-strkey",
      fc.property(
        fc.oneof(
          arbitraryValidStellarAddress,
          arbitraryCorruptedStellarAddress,
          fc.string({ minLength: 0, maxLength: 100 })
        ),
        (address) => {
          const ourResult = isValidStellarPublicKey(address);
          let sdkResult: boolean;
          try {
            sdkResult = StrKey.isValidEd25519PublicKey(address);
          } catch {
            sdkResult = false;
          }
          expect(ourResult).toBe(sdkResult);
        }
      ),
      { numRuns, seed }
    );
  });

  it("accepts all and only valid G-strkeys", () => {
    assertWithCorpus(
      "accepts-valid",
      fc.property(arbitraryValidStellarAddress, (address) => {
        expect(isValidStellarPublicKey(address)).toBe(true);
      }),
      { numRuns, seed }
    );
  });

  it("rejects addresses with corrupted checksums", () => {
    assertWithCorpus(
      "rejects-corrupted-checksum",
      fc.property(arbitraryCorruptedChecksumAddress, (address) => {
        expect(isValidStellarPublicKey(address)).toBe(false);
      }),
      { numRuns, seed }
    );
  });

  it("rejects addresses with wrong lengths", () => {
    assertWithCorpus(
      "rejects-wrong-length",
      fc.property(arbitraryWrongLengthAddress, (address) => {
        expect(isValidStellarPublicKey(address)).toBe(false);
      }),
      { numRuns, seed }
    );
  });

  it("never throws on any string input", () => {
    assertWithCorpus(
      "no-throws",
      fc.property(fc.string({ minLength: 0, maxLength: 200 }), (address) => {
        expect(() => isValidStellarPublicKey(address)).not.toThrow();
      }),
      { numRuns, seed }
    );
  });
});

// ─── Corpus replay ─────────────────────────────

describe("isValidStellarPublicKey — corpus replay", () => {
  const entries = loadCorpusEntries();

  for (const entry of entries) {
    const input =
      entry.input && typeof entry.input === "string" ? entry.input : null;
    if (input !== null) {
      it(`replays corpus entry ${entry.filename}`, () => {
        const ourResult = isValidStellarPublicKey(input);
        let sdkResult: boolean;
        try {
          sdkResult = StrKey.isValidEd25519PublicKey(input);
        } catch {
          sdkResult = false;
        }
        expect(ourResult).toBe(sdkResult);
      });
    }
  }
});
