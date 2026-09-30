import { CHAINS, DST_TOKENS, SRC_TOKENS } from "@/lib/marketData";
import { sanitizeDisplayText } from "@/lib/textSafety";
import type { FeedItem, IntentStatus } from "@/lib/types";

/**
 * Single source of truth for Explore/My Intents URL state and the free-text
 * search syntax (#441, #442). Everything here is pure; no RegExp is ever built
 * from user input.
 */

export const MAX_QUERY_LENGTH = 200;

export const STATUS_OPTIONS: Array<IntentStatus | "all"> = ["all", "pending", "accepted", "filled", "failed"];
export const SORT_OPTIONS = ["newest", "oldest", "largest"] as const;
export type SortOption = (typeof SORT_OPTIONS)[number];
export const RANGE_OPTIONS = ["all", "7", "30", "90"] as const;
export type RangeOption = (typeof RANGE_OPTIONS)[number];

export const CHAIN_IDS: readonly string[] = CHAINS.map((c) => c.id);
export const TOKEN_SYMBOLS: readonly string[] = Array.from(
  new Set([...Object.values(SRC_TOKENS).flat(), ...DST_TOKENS].map((t) => t.symbol.toUpperCase())),
).sort();
export const SEARCH_KEYS = ["status", "chain", "token"] as const;
export type SearchKey = (typeof SEARCH_KEYS)[number];

export function readStatus(value: string | null | undefined): IntentStatus | "all" {
  return value && (STATUS_OPTIONS as string[]).includes(value) ? (value as IntentStatus | "all") : "all";
}
export function readChain(value: string | null | undefined): string {
  return value && CHAIN_IDS.includes(value) ? value : "all";
}
export function readSort(value: string | null | undefined): SortOption {
  return value && (SORT_OPTIONS as readonly string[]).includes(value) ? (value as SortOption) : "newest";
}
export function readRange(value: string | null | undefined): RangeOption {
  return value && (RANGE_OPTIONS as readonly string[]).includes(value) ? (value as RangeOption) : "all";
}
export function readToken(value: string | null | undefined): string | null {
  const upper = value?.toUpperCase();
  return upper && TOKEN_SYMBOLS.includes(upper) ? upper : null;
}
/** Normalises a raw `?q=` value: strips invisible characters and caps length. */
export function readQuery(value: string | null | undefined): string {
  return sanitizeDisplayText(value ?? "").slice(0, MAX_QUERY_LENGTH);
}

export type ParsedSearch = {
  /** Lower-cased free-text terms; every term must match (AND). */
  terms: string[];
  status: IntentStatus | null;
  chain: string | null;
  token: string | null;
};

/** Splits on whitespace, keeping `"quoted phrases"` (and `key:"quoted value"`) together. */
export function tokenize(input: string): string[] {
  const tokens: string[] = [];
  let current = "";
  let inQuotes = false;
  let quoted = false;
  for (const ch of input) {
    if (ch === '"') {
      inQuotes = !inQuotes;
      quoted = true;
      continue;
    }
    if (!inQuotes && /\s/.test(ch)) {
      if (current || quoted) tokens.push(current);
      current = "";
      quoted = false;
      continue;
    }
    current += ch;
  }
  if (current || quoted) tokens.push(current);
  return tokens.filter((t) => t.trim() !== "");
}

/**
 * Parses free text + `key:value` tokens. Known keys with valid values become
 * structured filters; unknown keys and invalid values are treated as text.
 * The value is everything after the *first* colon, so `foo:a:b` keeps `a:b`.
 */
export function parseSearch(raw: string): ParsedSearch {
  const result: ParsedSearch = { terms: [], status: null, chain: null, token: null };
  for (const token of tokenize(readQuery(raw))) {
    const colon = token.indexOf(":");
    if (colon > 0) {
      const key = token.slice(0, colon).toLowerCase();
      const value = token.slice(colon + 1);
      if (key === "status" && readStatus(value.toLowerCase()) !== "all") {
        result.status = value.toLowerCase() as IntentStatus;
        continue;
      }
      if (key === "chain" && readChain(value.toLowerCase()) !== "all") {
        result.chain = value.toLowerCase();
        continue;
      }
      if (key === "token" && readToken(value)) {
        result.token = readToken(value);
        continue;
      }
    }
    result.terms.push(token.toLowerCase());
  }
  return result;
}

export function isEmptySearch(parsed: ParsedSearch): boolean {
  return parsed.terms.length === 0 && !parsed.status && !parsed.chain && !parsed.token;
}

/** Plain substring matching against sanitised fields (never RegExp). */
export function matchesSearch(item: FeedItem, parsed: ParsedSearch): boolean {
  if (parsed.status && item.status !== parsed.status) return false;
  if (parsed.chain && item.srcChain.toLowerCase() !== parsed.chain) return false;
  if (
    parsed.token &&
    item.srcToken.toUpperCase() !== parsed.token &&
    item.dstToken.toUpperCase() !== parsed.token
  ) {
    return false;
  }
  if (parsed.terms.length === 0) return true;
  const haystack = [item.id, item.srcToken, item.dstToken, item.srcChain, item.solver, item.status]
    .map((f) => sanitizeDisplayText(f).toLowerCase());
  return parsed.terms.every((term) => haystack.some((field) => field.includes(term)));
}

export type HighlightSegment = { text: string; match: boolean };

/** Splits `text` into matched/unmatched segments for safe React rendering. */
export function highlightSegments(text: string, terms: readonly string[]): HighlightSegment[] {
  const clean = sanitizeDisplayText(text);
  const lower = clean.toLowerCase();
  const needles = terms.filter((t) => t.length > 0);
  if (needles.length === 0) return clean ? [{ text: clean, match: false }] : [];

  const marks = new Array<boolean>(clean.length).fill(false);
  for (const needle of needles) {
    let from = lower.indexOf(needle);
    while (from !== -1) {
      for (let i = from; i < from + needle.length; i += 1) marks[i] = true;
      from = lower.indexOf(needle, from + needle.length);
    }
  }

  const segments: HighlightSegment[] = [];
  for (let i = 0; i < clean.length; i += 1) {
    const match = marks[i] ?? false;
    const last = segments[segments.length - 1];
    if (last && last.match === match) last.text += clean[i];
    else segments.push({ text: clean[i] ?? "", match });
  }
  return segments;
}

export type Suggestion = { value: string; kind: "status" | "chain" | "token" | "recent" };

/**
 * Suggests completions for the last (partial) word of `input`, plus matching
 * recent searches. Returns full replacement query strings.
 */
export function buildSuggestions(input: string, recent: readonly string[], limit = 8): Suggestion[] {
  const query = readQuery(input);
  const lastSpace = query.lastIndexOf(" ");
  const prefix = query.slice(0, lastSpace + 1);
  const word = query.slice(lastSpace + 1).toLowerCase();

  const candidates: Suggestion[] = [];
  if (word) {
    const pool: Array<[Suggestion["kind"], readonly string[]]> = [
      ["status", STATUS_OPTIONS.filter((s) => s !== "all")],
      ["chain", CHAIN_IDS],
      ["token", TOKEN_SYMBOLS],
    ];
    for (const [kind, values] of pool) {
      for (const value of values) {
        const tokenText = `${kind}:${value}`;
        if (tokenText.toLowerCase().startsWith(word) || value.toLowerCase().startsWith(word)) {
          candidates.push({ value: `${prefix}${tokenText} `, kind });
        }
      }
    }
  }
  const needle = query.trim().toLowerCase();
  for (const entry of recent) {
    if (!needle || entry.toLowerCase().includes(needle)) candidates.push({ value: entry, kind: "recent" });
  }
  const seen = new Set<string>();
  return candidates.filter((c) => (seen.has(c.value) ? false : (seen.add(c.value), true))).slice(0, limit);
}
