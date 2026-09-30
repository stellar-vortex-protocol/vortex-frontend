import { describe, expect, it } from "vitest";
import {
  MAX_QUERY_LENGTH,
  buildSuggestions,
  highlightSegments,
  isEmptySearch,
  matchesSearch,
  parseSearch,
  readChain,
  readQuery,
  readRange,
  readSort,
  readStatus,
  readToken,
  tokenize,
  type ParsedSearch,
} from "./searchQuery";
import type { FeedItem } from "./types";

const P = (partial: Partial<ParsedSearch>): ParsedSearch => ({
  terms: [],
  status: null,
  chain: null,
  token: null,
  ...partial,
});

describe("parseSearch", () => {
  it.each<[string, ParsedSearch]>([
    ["", P({})],
    ["   ", P({})],
    ["abc", P({ terms: ["abc"] })],
    ["ABC", P({ terms: ["abc"] })],
    ["abc def", P({ terms: ["abc", "def"] })],
    ["  abc   def  ", P({ terms: ["abc", "def"] })],
    ["abc\tdef\nghi", P({ terms: ["abc", "def", "ghi"] })],
    ["status:filled", P({ status: "filled" })],
    ["status:FILLED", P({ status: "filled" })],
    ["STATUS:pending", P({ status: "pending" })],
    ["status:accepted", P({ status: "accepted" })],
    ["status:failed", P({ status: "failed" })],
    ["status:all", P({ terms: ["status:all"] })],
    ["status:bogus", P({ terms: ["status:bogus"] })],
    ["status:", P({ terms: ["status:"] })],
    ["chain:base", P({ chain: "base" })],
    ["chain:Ethereum", P({ chain: "ethereum" })],
    ["chain:solana", P({ terms: ["chain:solana"] })],
    ["token:USDC", P({ token: "USDC" })],
    ["token:usdc", P({ token: "USDC" })],
    ["token:xlm", P({ token: "XLM" })],
    ["token:DOGE", P({ terms: ["token:doge"] })],
    ["solver:GABC", P({ terms: ["solver:gabc"] })],
    ["foo:bar", P({ terms: ["foo:bar"] })],
    [":leading", P({ terms: [":leading"] })],
    ["a:b:c", P({ terms: ["a:b:c"] })],
    ["chain:base:extra", P({ terms: ["chain:base:extra"] })],
    ["status:filled chain:base token:USDC", P({ status: "filled", chain: "base", token: "USDC" })],
    ["status:filled status:failed", P({ status: "failed" })],
    ["status:filled abc", P({ status: "filled", terms: ["abc"] })],
    ['"exact phrase"', P({ terms: ["exact phrase"] })],
    ['"exact phrase" other', P({ terms: ["exact phrase", "other"] })],
    ['token:"USDC"', P({ token: "USDC" })],
    ['chain:"base"', P({ chain: "base" })],
    ['"unterminated phrase', P({ terms: ["unterminated phrase"] })],
    ['""', P({})],
    ['" "', P({})],
    ["(.*)+", P({ terms: ["(.*)+"] })],
    ["[abc]", P({ terms: ["[abc]"] })],
    ["a\\b", P({ terms: ["a\\b"] })],
    ["$^|?", P({ terms: ["$^|?"] })],
    ["ab​c", P({ terms: ["abc"] })],
    ["‮evil", P({ terms: ["evil"] })],
    ["日本語 検索", P({ terms: ["日本語", "検索"] })],
  ])("parses %j", (input, expected) => {
    expect(parseSearch(input)).toEqual(expected);
  });

  it("caps extremely long queries", () => {
    const parsed = parseSearch("x".repeat(MAX_QUERY_LENGTH + 500));
    expect(parsed.terms[0]).toHaveLength(MAX_QUERY_LENGTH);
  });
});

describe("tokenize", () => {
  it("keeps key:\"quoted value\" together", () => {
    expect(tokenize('solver:"my solver" x')).toEqual(["solver:my solver", "x"]);
  });
});

describe("URL readers", () => {
  it.each([
    [readStatus, "filled", "filled"],
    [readStatus, "nope", "all"],
    [readStatus, null, "all"],
    [readChain, "base", "base"],
    [readChain, "mars", "all"],
    [readSort, "largest", "largest"],
    [readSort, "random", "newest"],
    [readRange, "7", "7"],
    [readRange, "8", "all"],
  ] as const)("%o(%j) -> %j", (reader, input, expected) => {
    expect((reader as (v: string | null) => string)(input)).toBe(expected);
  });

  it("readToken normalises case and rejects unknown symbols", () => {
    expect(readToken("usdc")).toBe("USDC");
    expect(readToken("nope")).toBeNull();
    expect(readToken(undefined)).toBeNull();
  });

  it("readQuery strips invisible characters", () => {
    expect(readQuery("a​b")).toBe("ab");
    expect(readQuery(null)).toBe("");
  });
});

const item: FeedItem = {
  id: "intent-123",
  srcChain: "base",
  srcToken: "USDC",
  srcAmount: "100",
  dstToken: "XLM",
  solver: "GSOLVER",
  status: "filled",
  createdAt: "2026-01-01T00:00:00Z",
};

describe("matchesSearch", () => {
  it.each<[string, boolean]>([
    ["", true],
    ["intent-12", true],
    ["gsolver", true],
    ["usdc xlm", true],
    ["usdc eth", false],
    ["status:filled", true],
    ["status:pending", false],
    ["chain:base", true],
    ["chain:polygon", false],
    ["token:XLM", true],
    ["token:WETH", false],
    ["(.*)", false],
  ])("%j -> %s", (query, expected) => {
    expect(matchesSearch(item, parseSearch(query))).toBe(expected);
  });

  it("isEmptySearch", () => {
    expect(isEmptySearch(parseSearch(""))).toBe(true);
    expect(isEmptySearch(parseSearch("status:filled"))).toBe(false);
  });
});

describe("highlightSegments", () => {
  it("marks every occurrence case-insensitively", () => {
    expect(highlightSegments("USDC-usdc", ["usdc"])).toEqual([
      { text: "USDC", match: true },
      { text: "-", match: false },
      { text: "usdc", match: true },
    ]);
  });

  it("returns plain text when there are no terms", () => {
    expect(highlightSegments("abc", [])).toEqual([{ text: "abc", match: false }]);
    expect(highlightSegments("", [])).toEqual([]);
  });

  it("treats HTML as text and strips bidi characters", () => {
    expect(highlightSegments("<b>‮x", ["<b>"])).toEqual([
      { text: "<b>", match: true },
      { text: "x", match: false },
    ]);
  });
});

describe("buildSuggestions", () => {
  it("completes the last word to a structured token", () => {
    const values = buildSuggestions("abc stat", []).map((s) => s.value);
    expect(values).toContain("abc status:filled ");
  });

  it("matches by value too", () => {
    expect(buildSuggestions("bas", []).map((s) => s.value)).toContain("chain:base ");
  });

  it("includes matching recent searches and dedupes", () => {
    const s = buildSuggestions("", ["foo", "foo", "bar"]);
    expect(s).toEqual([
      { value: "foo", kind: "recent" },
      { value: "bar", kind: "recent" },
    ]);
  });

  it("respects the limit", () => {
    expect(buildSuggestions("t", [], 3)).toHaveLength(3);
  });
});
