import { describe, expect, it } from "vitest";
import fc from "fast-check";
import {
  arbitraryCsvCell,
  getNumRuns,
  getSeed,
  assertWithCorpus,
  loadCorpusEntries,
} from "../test/arbitraries";
import { escapeCsv } from "./csv";

// ─── Helpers ──────────────────────────────────────────

const FORMULA_TRIGGERS = ["=", "+", "-", "@", "\t", "\r"];

function startsWithFormulaTrigger(s: string): boolean {
  if (s.length === 0) return false;
  return FORMULA_TRIGGERS.includes(s[0]);
}

// ─── Fuzz properties ──────────────────────────────────

describe("escapeCsv — fuzz properties", () => {
  const numRuns = getNumRuns();
  const seed = getSeed();

  it("output never begins with a formula trigger character", () => {
    assertWithCorpus(
      "no-formula-trigger-in-output",
      fc.property(arbitraryCsvCell, (cell) => {
        const escaped = escapeCsv(cell);
        expect(startsWithFormulaTrigger(escaped)).toBe(false);
      }),
      { numRuns, seed }
    );
  });

  it("is idempotent on already-escaped values", () => {
    assertWithCorpus(
      "idempotent",
      fc.property(arbitraryCsvCell, (cell) => {
        const once = escapeCsv(cell);
        const twice = escapeCsv(once);
        expect(twice).toBe(once);
      }),
      { numRuns, seed }
    );
  });

  it("preserves the original content after the optional leading apostrophe", () => {
    assertWithCorpus(
      "preserves-content",
      fc.property(arbitraryCsvCell, (cell) => {
        const escaped = escapeCsv(cell);
        // If the escaped value starts with an apostrophe, the rest
        // should contain the original value (possibly quoted).
        if (escaped.startsWith("'")) {
          const withoutApostrophe = escaped.slice(1);
          // The original cell content must appear somewhere in the
          // quoted/apostrophed output.
          expect(withoutApostrophe).toContain(cell);
        }
      }),
      { numRuns, seed }
    );
  });

  it("never produces an unquoted cell that contains an unescaped double-quote", () => {
    assertWithCorpus(
      "no-unescaped-quotes",
      fc.property(arbitraryCsvCell, (cell) => {
        const escaped = escapeCsv(cell);
        // If the cell is not wrapped in double-quotes, it must not
        // contain any unescaped double-quotes.
        if (!escaped.startsWith('"')) {
          expect(escaped).not.toContain('"');
        }
      }),
      { numRuns, seed }
    );
  });
});

// ─── Corpus replay ─────────────────────────────────────

describe("escapeCsv — corpus replay", () => {
  const entries = loadCorpusEntries();

  for (const entry of entries) {
    const input =
      entry.input && typeof entry.input === "string" ? entry.input : null;
    if (input !== null) {
      it(`replays corpus entry ${entry.filename}`, () => {
        const escaped = escapeCsv(input);
        expect(startsWithFormulaTrigger(escaped)).toBe(false);
      });
    }
  }
});
