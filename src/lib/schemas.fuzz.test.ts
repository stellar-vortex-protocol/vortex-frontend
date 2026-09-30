import { describe, expect, it } from "vitest";
import fc from "fast-check";
import {
  arbitraryJson,
  getNumRuns,
  getSeed,
  assertWithCorpus,
  loadCorpusEntries,
} from "../test/arbitraries";
import {
  isQuote,
  isFeedItem,
  isFeedItemArray,
  isIntentDetail,
  isSolver,
  isSolverArray,
  isCreateIntentResponse,
  isSubmitIntentResponse,
  isRegisterSolverResponse,
  isSubmitRegistrationResponse,
} from "./schemas";

// ─── Fuzz properties ──────────────────────────────

describe("schema validators — fuzz properties", () => {
  const numRuns = getNumRuns();
  const seed = getSeed();

  it("never throws on arbitrary JSON input", () => {
    assertWithCorpus(
      "no-throws",
      fc.property(arbitraryJson, (json) => {
        expect(() => isQuote(json)).not.toThrow();
        expect(() => isFeedItem(json)).not.toThrow();
        expect(() => isFeedItemArray(json)).not.toThrow();
        expect(() => isIntentDetail(json)).not.toThrow();
        expect(() => isSolver(json)).not.toThrow();
        expect(() => isSolverArray(json)).not.toThrow();
        expect(() => isCreateIntentResponse(json)).not.toThrow();
        expect(() => isSubmitIntentResponse(json)).not.toThrow();
        expect(() => isRegisterSolverResponse(json)).not.toThrow();
        expect(() => isSubmitRegistrationResponse(json)).not.toThrow();
      }),
      { numRuns, seed }
    );
  });

  it("always returns a boolean", () => {
    assertWithCorpus(
      "returns-boolean",
      fc.property(arbitraryJson, (json) => {
        expect(typeof isQuote(json)).toBe("boolean");
        expect(typeof isFeedItem(json)).toBe("boolean");
        expect(typeof isFeedItemArray(json)).toBe("boolean");
        expect(typeof isIntentDetail(json)).toBe("boolean");
        expect(typeof isSolver(json)).toBe("boolean");
        expect(typeof isSolverArray(json)).toBe("boolean");
        expect(typeof isCreateIntentResponse(json)).toBe("boolean");
        expect(typeof isSubmitIntentResponse(json)).toBe("boolean");
        expect(typeof isRegisterSolverResponse(json)).toBe("boolean");
        expect(typeof isSubmitRegistrationResponse(json)).toBe("boolean");
      }),
      { numRuns, seed }
    );
  });
});

// ─── Corpus replay ─────────────────────────────────

describe("schema validators — corpus replay", () => {
  const entries = loadCorpusEntries();

  for (const entry of entries) {
    it(`replays corpus entry ${entry.filename}`, () => {
      const json = entry.input;
      expect(() => isQuote(json)).not.toThrow();
      expect(() => isFeedItem(json)).not.toThrow();
      expect(() => isFeedItemArray(json)).not.toThrow();
      expect(() => isIntentDetail(json)).not.toThrow();
      expect(() => isSolver(json)).not.toThrow();
      expect(() => isSolverArray(json)).not.toThrow();
      expect(() => isCreateIntentResponse(json)).not.toThrow();
      expect(() => isSubmitIntentResponse(json)).not.toThrow();
      expect(() => isRegisterSolverResponse(json)).not.toThrow();
      expect(() => isSubmitRegistrationResponse(json)).not.toThrow();
    });
  }
});
