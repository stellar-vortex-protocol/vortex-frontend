import { describe, expect, it } from "vitest";
import fc from "fast-check";
import {
  arbitraryXdrEnvelope,
  arbitraryMutatedXdrEnvelope,
  getNumRuns,
  getSeed,
  assertWithCorpus,
  loadCorpusEntries,
} from "../test/arbitraries";
import { decodeXdr } from "./xdrReview";

// ─── Fuzz properties ──────────────────────────────────

describe("decodeXdr — fuzz properties", () => {
  const numRuns = getNumRuns();
  const seed = getSeed();

  it("never throws a non-Error exception on any XDR input", () => {
    assertWithCorpus(
      "no-non-error-exceptions",
      fc.property(
        fc.oneof(arbitraryXdrEnvelope, arbitraryMutatedXdrEnvelope),
        (xdr) => {
          let threw = false;
          try {
            decodeXdr(xdr, "testnet");
          } catch (err) {
            threw = true;
            // Any thrown value must be an instance of Error
            expect(err).toBeInstanceOf(Error);
          }
          // If it didn't throw, that's also fine — the XDR may be valid
          expect(threw || true).toBe(true);
        }
      ),
      { numRuns, seed }
    );
  });

  it("terminates in bounded time (completes within 1 second per run)", () => {
    assertWithCorpus(
      "bounded-time",
      fc.property(
        fc.oneof(arbitraryXdrEnvelope, arbitraryMutatedXdrEnvelope),
        (xdr) => {
          const start = Date.now();
          try {
            decodeXdr(xdr, "testnet");
          } catch {
            // swallow — we only care about timing
          }
          expect(Date.now() - start).toBeLessThan(1000);
        }
      ),
      { numRuns, seed }
    );
  });

  it("returns a result with the expected shape when decoding succeeds", () => {
    assertWithCorpus(
      "valid-result-shape",
      fc.property(arbitraryXdrEnvelope, (xdr) => {
        const result = decodeXdr(xdr, "testnet");
        expect(result).toHaveProperty("networkPassphrase");
        expect(result).toHaveProperty("fee");
        expect(result).toHaveProperty("operationCount");
        expect(result).toHaveProperty("operations");
        expect(result).toHaveProperty("sourceAccount");
        expect(typeof result.operationCount).toBe("number");
        expect(Array.isArray(result.operations)).toBe(true);
      }),
      { numRuns, seed }
    );
  });
});

// ─── Corpus replay ─────────────────────────────────────

describe("decodeXdr — corpus replay", () => {
  const entries = loadCorpusEntries();

  for (const entry of entries) {
    const input =
      entry.input && typeof entry.input === "string" ? entry.input : null;
    if (input !== null) {
      it(`replays corpus entry ${entry.filename}`, () => {
        let threw = false;
        try {
          decodeXdr(input, "testnet");
        } catch (err) {
          threw = true;
          expect(err).toBeInstanceOf(Error);
        }
        expect(threw || true).toBe(true);
      });
    }
  }
});
