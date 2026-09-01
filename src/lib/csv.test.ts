import { describe, expect, it } from "vitest";
import { escapeCsv, buildIntentsCsv } from "./csv";
import type { FeedItem } from "./types";

// ─── escapeCsv ───────────────────────────────────────────────────────────────

describe("escapeCsv — formula injection neutralisation", () => {
  // Each of these is a known CSV/formula-injection vector.

  it("prefixes '=' with an apostrophe", () => {
    // The apostrophe-prefixed value still contains double-quotes (from the
    // original formula string), so the standard CSV quoting wraps it in
    // double-quotes and escapes the internal quotes.
    const result = escapeCsv('=HYPERLINK("http://evil.example","click")');
    // Must start with apostrophe to be formula-inert:
    expect(result).toContain("'=HYPERLINK");
    // The raw '=' must not be the very first character of the CSV cell:
    expect(result[0]).not.toBe("=");
  });

  it("prefixes '+' with an apostrophe", () => {
    expect(escapeCsv("+cmd|'/c calc'!A0")).toBe("'+cmd|'/c calc'!A0");
  });

  it("prefixes '-' with an apostrophe", () => {
    // A leading hyphen is a trigger character; the value is preserved as text.
    expect(escapeCsv("-1")).toBe("'-1");
  });

  it("prefixes '@' with an apostrophe", () => {
    expect(escapeCsv("@SUM(1+1)*cmd|' /C calc'!A0")).toBe(
      "'@SUM(1+1)*cmd|' /C calc'!A0"
    );
  });

  it("prefixes a leading tab character with an apostrophe", () => {
    // Tab as a field delimiter injection.
    expect(escapeCsv("\t=MALICIOUS()")).toBe("'\t=MALICIOUS()");
  });

  it("prefixes a leading carriage-return character with an apostrophe", () => {
    // The value starts with \r which is a trigger character, so it gets
    // prefixed with apostrophe.  Since the apostrophe-prefixed value still
    // contains a \r, the standard CSV quoting then wraps it in double-quotes.
    const result = escapeCsv("\r=MALICIOUS()");
    // The cell must start with a quote (CSV-quoted) or apostrophe, not bare \r:
    expect(result[0]).not.toBe("\r");
    // The apostrophe-prefix must be present:
    expect(result).toContain("'\r=MALICIOUS()");
  });

  it("does NOT alter values that are safe plain text", () => {
    expect(escapeCsv("hello")).toBe("hello");
    expect(escapeCsv("Alpha Liquidity")).toBe("Alpha Liquidity");
    expect(escapeCsv("pending")).toBe("pending");
  });

  it("does NOT alter positive numeric-looking strings", () => {
    expect(escapeCsv("500")).toBe("500");
    expect(escapeCsv("1234.56")).toBe("1234.56");
  });

  it("does NOT alter empty string", () => {
    expect(escapeCsv("")).toBe("");
  });
});

describe("escapeCsv — standard CSV quoting", () => {
  it("quotes a value containing a comma", () => {
    expect(escapeCsv("hello, world")).toBe('"hello, world"');
  });

  it("quotes a value containing a double-quote and escapes it", () => {
    expect(escapeCsv('say "hi"')).toBe('"say ""hi"""');
  });

  it("quotes a value containing a newline", () => {
    expect(escapeCsv("line1\nline2")).toBe('"line1\nline2"');
  });

  it("applies formula-injection prefix first, then CSV quoting when both are needed", () => {
    // e.g. a malicious value that also contains a comma
    const value = '=HYPERLINK("http://evil.example","c,lick")';
    const escaped = escapeCsv(value);
    // Should start with apostrophe and be double-quoted because of the comma.
    expect(escaped.startsWith('"\'=')).toBe(true);
    expect(escaped.endsWith('"')).toBe(true);
  });
});

// ─── buildIntentsCsv ─────────────────────────────────────────────────────────

describe("buildIntentsCsv", () => {
  const baseIntent: FeedItem = {
    id: "abc-123",
    srcChain: "ethereum",
    srcToken: "USDC",
    srcAmount: "500",
    dstToken: "XLM",
    solver: "Beta Liquidity",
    status: "filled",
    createdAt: "2026-01-01T00:00:00.000Z",
  };

  it("includes a header row", () => {
    const csv = buildIntentsCsv([baseIntent]);
    const [header] = csv.split("\n");
    expect(header).toBe(
      "id,srcChain,srcToken,srcAmount,dstToken,solver,status,createdAt"
    );
  });

  it("produces one data row per intent", () => {
    const csv = buildIntentsCsv([baseIntent, baseIntent]);
    const lines = csv.split("\n");
    expect(lines).toHaveLength(3); // 1 header + 2 data rows
  });

  it("escapes a malicious solver name in the output", () => {
    const malicious: FeedItem = {
      ...baseIntent,
      solver: '=HYPERLINK("http://evil.example","click")',
    };
    const csv = buildIntentsCsv([malicious]);
    // The data row must not start with '=' in the solver column position.
    const dataRow = csv.split("\n")[1];
    // The solver field should be prefixed with apostrophe.
    expect(dataRow).toContain("'=HYPERLINK");
    // The raw '=' must not appear as the first character of the cell.
    const solverField = dataRow.split(",")[5];
    expect(solverField).not.toMatch(/^=/);
  });

  it("handles intents with undefined optional fields gracefully", () => {
    const partial = { ...baseIntent, solver: undefined as unknown as string };
    expect(() => buildIntentsCsv([partial])).not.toThrow();
  });
});
