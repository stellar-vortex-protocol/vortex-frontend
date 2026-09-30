import { describe, expect, it } from "vitest";
import fc from "fast-check";
import {
  arbitraryUnicodeString,
  arbitraryDangerousUnicodeString,
  getNumRuns,
  getSeed,
  assertWithCorpus,
  loadCorpusEntries,
} from "../test/arbitraries";
import { sanitizeDisplayText } from "./textSafety";

// ─── Dangerous Unicode ranges (independently defined, not
//      relying on the implementation under test) ──────────────

const BIDI_RANGES: ReadonlyArray<[number, number]> = [
  [0x202a, 0x202e], // U+202A–U+202E
  [0x2066, 0x2069], // U+2066–U+2069
];

const ZERO_WIDTH_RANGES: ReadonlyArray<[number, number]> = [
  [0x200b, 0x200d], // U+200B–U+200D
  [0xfeff, 0xfeff], // U+FEFF
  [0x00ad, 0x00ad], // U+00AD
];

const ALL_DANGEROUS_RANGES = [
  ...BIDI_RANGES,
  ...ZERO_WIDTH_RANGES,
];

function codePointIsDangerous(cp: number): boolean {
  return ALL_DANGEROUS_RANGES.some(
    ([lo, hi]) => cp >= lo && cp <= hi
  );
}

function stringContainsDangerousChar(s: string): boolean {
  for (const char of s) {
    const cp = char.codePointAt(0)!;
    if (codePointIsDangerous(cp)) return true;
  }
  return false;
}

// ─── Fuzz properties ──────────────────────────────────

describe("sanitizeDisplayText — fuzz properties", () => {
  const numRuns = getNumRuns();
  const seed = getSeed();

  it("is idempotent: sanitising twice produces the same result as sanitising once", () => {
    assertWithCorpus(
      "idempotent",
      fc.property(arbitraryUnicodeString, (s) => {
        const once = sanitizeDisplayText(s);
        const twice = sanitizeDisplayText(once);
        expect(twice).toBe(once);
      }),
      { numRuns, seed }
    );
  });

  it("never leaves a dangerous character in the output", () => {
    assertWithCorpus(
      "no-dangerous-chars-in-output",
      fc.property(arbitraryUnicodeString, (s) => {
        const sanitized = sanitizeDisplayText(s);
        expect(stringContainsDangerousChar(sanitized)).toBe(false);
      }),
      { numRuns, seed }
    );
  });

  it("removes every dangerous character that appears in the input", () => {
    assertWithCorpus(
      "removes-dangerous-chars",
      fc.property(arbitraryDangerousUnicodeString, (s) => {
        const sanitized = sanitizeDisplayText(s);
        expect(stringContainsDangerousChar(sanitized)).toBe(false);
      }),
      { numRuns, seed }
    );
  });

  it("does not strip safe characters (ASCII printable)", () => {
    assertWithCorpus(
      "preserves-safe-chars",
      fc.property(
        fc.string({ minLength: 1, maxLength: 100, charLevel: { freq: { print: 1 } } }),
        (s) => {
          expect(sanitizeDisplayText(s)).toBe(s);
        }
      ),
      { numRuns, seed }
    );
  });
});

// ─── Corpus replay ─────────────────────────────────────

describe("sanitizeDisplayText — corpus replay", () => {
  const entries = loadCorpusEntries();

  for (const entry of entries) {
    const input =
      entry.input && typeof entry.input === "string" ? entry.input : null;
    if (input !== null) {
      it(`replays corpus entry ${entry.filename}`, () => {
        const sanitized = sanitizeDisplayText(input);
        expect(stringContainsDangerousChar(sanitized)).toBe(false);
      });
    }
  }
});
