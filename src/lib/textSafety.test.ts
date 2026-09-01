import { describe, expect, it } from "vitest";
import { sanitizeDisplayText, containsDangerousUnicode } from "./textSafety";

// ─── sanitizeDisplayText ──────────────────────────────────────────────────────

describe("sanitizeDisplayText — bidi control characters", () => {
  it("strips RIGHT-TO-LEFT OVERRIDE (U+202E)", () => {
    const malicious = "normal\u202Ereversed";
    expect(sanitizeDisplayText(malicious)).toBe("normalreversed");
  });

  it("strips LEFT-TO-RIGHT OVERRIDE (U+202D)", () => {
    expect(sanitizeDisplayText("abc\u202Ddef")).toBe("abcdef");
  });

  it("strips LEFT-TO-RIGHT EMBEDDING (U+202A)", () => {
    expect(sanitizeDisplayText("\u202Ahello\u202C")).toBe("hello");
  });

  it("strips RIGHT-TO-LEFT EMBEDDING (U+202B)", () => {
    expect(sanitizeDisplayText("\u202Bhello\u202C")).toBe("hello");
  });

  it("strips POP DIRECTIONAL FORMATTING (U+202C)", () => {
    expect(sanitizeDisplayText("a\u202Cb")).toBe("ab");
  });

  it("strips LEFT-TO-RIGHT ISOLATE (U+2066)", () => {
    expect(sanitizeDisplayText("\u2066text\u2069")).toBe("text");
  });

  it("strips RIGHT-TO-LEFT ISOLATE (U+2067)", () => {
    expect(sanitizeDisplayText("\u2067text\u2069")).toBe("text");
  });

  it("strips FIRST STRONG ISOLATE (U+2068)", () => {
    expect(sanitizeDisplayText("\u2068text\u2069")).toBe("text");
  });

  it("strips POP DIRECTIONAL ISOLATE (U+2069)", () => {
    expect(sanitizeDisplayText("x\u2069y")).toBe("xy");
  });

  it("strips multiple bidi overrides in one string", () => {
    const payload = "\u202ESolver\u202D Name\u202C";
    expect(sanitizeDisplayText(payload)).toBe("Solver Name");
  });
});

describe("sanitizeDisplayText — zero-width and invisible characters", () => {
  it("strips ZERO WIDTH SPACE (U+200B)", () => {
    expect(sanitizeDisplayText("a\u200Bb")).toBe("ab");
  });

  it("strips ZERO WIDTH NON-JOINER (U+200C)", () => {
    expect(sanitizeDisplayText("a\u200Cb")).toBe("ab");
  });

  it("strips ZERO WIDTH JOINER (U+200D)", () => {
    expect(sanitizeDisplayText("a\u200Db")).toBe("ab");
  });

  it("strips ZERO WIDTH NO-BREAK SPACE / BOM (U+FEFF)", () => {
    expect(sanitizeDisplayText("\uFEFFhello")).toBe("hello");
  });

  it("strips SOFT HYPHEN (U+00AD)", () => {
    expect(sanitizeDisplayText("sol\u00ADver")).toBe("solver");
  });

  it("strips a combination of zero-width chars and bidi overrides", () => {
    const payload = "\u202E\u200Bmalicious\u200D\u202C";
    expect(sanitizeDisplayText(payload)).toBe("malicious");
  });
});

describe("sanitizeDisplayText — safe strings are unchanged", () => {
  it("leaves plain ASCII unchanged", () => {
    expect(sanitizeDisplayText("Alpha Liquidity")).toBe("Alpha Liquidity");
  });

  it("leaves a Stellar address unchanged", () => {
    const addr = "GBZH7S5NC57XNHKHJ75C5DGMI3SP6ZFJLIKW74K6OSMA5UI5KU5XW7S";
    expect(sanitizeDisplayText(addr)).toBe(addr);
  });

  it("leaves a non-Latin solver name unchanged (Arabic)", () => {
    const arabic = "مزود السيولة";
    expect(sanitizeDisplayText(arabic)).toBe(arabic);
  });

  it("leaves a non-Latin solver name unchanged (Japanese)", () => {
    const japanese = "流動性プロバイダー";
    expect(sanitizeDisplayText(japanese)).toBe(japanese);
  });

  it("leaves a non-Latin solver name unchanged (Cyrillic)", () => {
    const cyrillic = "Решение ликвидности";
    expect(sanitizeDisplayText(cyrillic)).toBe(cyrillic);
  });

  it("leaves an empty string unchanged", () => {
    expect(sanitizeDisplayText("")).toBe("");
  });

  it("leaves regular hyphens unchanged", () => {
    // A normal hyphen-minus (U+002D) must not be stripped.
    expect(sanitizeDisplayText("Solver-One")).toBe("Solver-One");
  });

  it("leaves regular whitespace unchanged", () => {
    expect(sanitizeDisplayText("Alpha  Beta")).toBe("Alpha  Beta");
  });
});

// ─── containsDangerousUnicode ─────────────────────────────────────────────────

describe("containsDangerousUnicode", () => {
  it("returns true for a string with RTL override", () => {
    expect(containsDangerousUnicode("abc\u202Edef")).toBe(true);
  });

  it("returns true for a string with zero-width space", () => {
    expect(containsDangerousUnicode("abc\u200Bdef")).toBe(true);
  });

  it("returns false for a safe ASCII string", () => {
    expect(containsDangerousUnicode("Alpha Liquidity")).toBe(false);
  });

  it("returns false for a Stellar address", () => {
    expect(
      containsDangerousUnicode("GBZH7S5NC57XNHKHJ75C5DGMI3SP6ZFJLIKW74K6OSMA5UI5KU5XW7S")
    ).toBe(false);
  });
});
