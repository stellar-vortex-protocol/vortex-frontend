/**
 * Confusable-address detection (address-poisoning defence).
 *
 * Flags a candidate address that *resembles* — but is not identical to — an
 * address the user has seen before. Attackers generate vanity addresses that
 * share the first/last few characters with a victim's real counterparty,
 * because wallets and explorers truncate addresses to exactly those
 * characters (`GABC...WXYZ`).
 *
 * False-positive policy (see docs/security-audit.md):
 * - An address identical to a known one (including the user's own) never flags.
 * - `high` (blocking, dismissible): same first N **and** last M characters, or
 *   a Hamming distance ≤ `maxEditDistance` from a known address.
 * - `low` (informational only): only the prefix or only the suffix matches.
 *   Random collisions are expected here (~6% for a 4-char prefix against
 *   2,000 addresses), so the UI does not block on `low`.
 * - Lookups are indexed by prefix and suffix, so assessment is O(bucket size),
 *   never O(n²) over the history; bucket scans are capped.
 */

import { confusableSkeleton, hasMixedScripts } from "./textSafety";

export type AddressRiskLevel = "none" | "low" | "high";

export type AddressRiskReason =
  | "prefixAndSuffixMatch"
  | "nearIdentical"
  | "prefixMatch"
  | "suffixMatch"
  | "labelConfusable"
  | "labelMixedScripts";

export interface AddressAssessment {
  risk: AddressRiskLevel;
  reasons: AddressRiskReason[];
  /** The known address the candidate most resembles, if any. */
  lookalike?: string;
}

export interface AddressRiskOptions {
  prefixLength?: number;
  suffixLength?: number;
  maxEditDistance?: number;
}

export interface AddressIndex {
  readonly all: ReadonlySet<string>;
  readonly byPrefix: ReadonlyMap<string, string[]>;
  readonly bySuffix: ReadonlyMap<string, string[]>;
  readonly prefixLength: number;
  readonly suffixLength: number;
}

const DEFAULTS = { prefixLength: 4, suffixLength: 4, maxEditDistance: 4 };
const MAX_BUCKET_SCAN = 64;

const normalize = (a: string) => a.trim().toUpperCase();

function push(map: Map<string, string[]>, key: string, value: string) {
  const bucket = map.get(key);
  if (bucket) bucket.push(value);
  else map.set(key, [value]);
}

const indexCache = new WeakMap<readonly string[], Map<string, AddressIndex>>();

/** Builds (and memoises per input array + options) a prefix/suffix index. */
export function buildAddressIndex(known: readonly string[], options: AddressRiskOptions = {}): AddressIndex {
  const prefixLength = options.prefixLength ?? DEFAULTS.prefixLength;
  const suffixLength = options.suffixLength ?? DEFAULTS.suffixLength;
  const cacheKey = `${prefixLength}:${suffixLength}`;
  const cached = indexCache.get(known)?.get(cacheKey);
  if (cached) return cached;

  const all = new Set<string>();
  const byPrefix = new Map<string, string[]>();
  const bySuffix = new Map<string, string[]>();
  for (const raw of known) {
    const address = normalize(raw);
    if (!address || all.has(address)) continue;
    all.add(address);
    push(byPrefix, address.slice(0, prefixLength), address);
    push(bySuffix, address.slice(-suffixLength), address);
  }
  const index: AddressIndex = { all, byPrefix, bySuffix, prefixLength, suffixLength };

  const perArray = indexCache.get(known) ?? new Map<string, AddressIndex>();
  perArray.set(cacheKey, index);
  indexCache.set(known, perArray);
  return index;
}

function hamming(a: string, b: string, limit: number): number {
  if (a.length !== b.length) return Infinity;
  let d = 0;
  for (let i = 0; i < a.length && d <= limit; i++) if (a[i] !== b[i]) d++;
  return d;
}

export function assessAddress(
  candidate: string,
  known: readonly string[] | AddressIndex,
  options: AddressRiskOptions = {},
): AddressAssessment {
  const index = Array.isArray(known)
    ? buildAddressIndex(known as readonly string[], options)
    : (known as AddressIndex);
  const maxEditDistance = options.maxEditDistance ?? DEFAULTS.maxEditDistance;
  const address = normalize(candidate);

  if (!address || index.all.has(address)) return { risk: "none", reasons: [] };

  const prefix = address.slice(0, index.prefixLength);
  const suffix = address.slice(-index.suffixLength);
  const pool = new Set([
    ...(index.byPrefix.get(prefix) ?? []).slice(0, MAX_BUCKET_SCAN),
    ...(index.bySuffix.get(suffix) ?? []).slice(0, MAX_BUCKET_SCAN),
  ]);

  let low: AddressAssessment | null = null;
  for (const k of pool) {
    const samePrefix = k.startsWith(prefix);
    const sameSuffix = k.endsWith(suffix);
    if (samePrefix && sameSuffix) {
      return { risk: "high", reasons: ["prefixAndSuffixMatch"], lookalike: k };
    }
    if (hamming(address, k, maxEditDistance) <= maxEditDistance) {
      return { risk: "high", reasons: ["nearIdentical"], lookalike: k };
    }
    low ??= { risk: "low", reasons: [samePrefix ? "prefixMatch" : "suffixMatch"], lookalike: k };
  }
  return low ?? { risk: "none", reasons: [] };
}

/**
 * Flags a label (e.g. an address-book name) that visually impersonates a
 * known label via homoglyphs or mixed scripts.
 */
export function assessLabel(label: string, knownLabels: readonly string[]): AddressAssessment {
  const reasons: AddressRiskReason[] = [];
  const skeleton = confusableSkeleton(label);
  const lookalike = knownLabels.find((k) => k !== label && confusableSkeleton(k) === skeleton);
  if (lookalike) reasons.push("labelConfusable");
  if (hasMixedScripts(label)) reasons.push("labelMixedScripts");
  if (reasons.length === 0) return { risk: "none", reasons };
  return lookalike ? { risk: "high", reasons, lookalike } : { risk: "low", reasons };
}

/** Splits two equal-length strings into runs of matching / differing chars. */
export function diffSegments(a: string, b: string): { text: string; differs: boolean }[] {
  const segments: { text: string; differs: boolean }[] = [];
  for (let i = 0; i < a.length; i++) {
    const differs = a[i] !== b[i];
    const last = segments[segments.length - 1];
    if (last && last.differs === differs) last.text += a[i];
    else segments.push({ text: a[i]!, differs });
  }
  return segments;
}
