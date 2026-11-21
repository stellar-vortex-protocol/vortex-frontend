import type { FeedItem } from "@/lib/generated/relay";
import type { AnalyticsShareState } from "@/lib/export/analyticsExport";

/**
 * Client-side analytics filters (issue #600). Filtering happens on the loaded
 * intent set before `computeAnalytics` runs, so every panel (KPIs, Sankey,
 * concentration, top movers, SLA) reflects the same filtered dataset.
 */
export type AnalyticsFilters = {
  /** Inclusive ISO date (YYYY-MM-DD) lower bound on `createdAt` */
  from?: string;
  /** Inclusive ISO date (YYYY-MM-DD) upper bound on `createdAt` */
  to?: string;
  /** Source chain id, or undefined for all chains */
  chain?: string;
  /** Destination token symbol, or undefined for all tokens */
  token?: string;
};

export const EMPTY_FILTERS: AnalyticsFilters = {};

/** Normalise a filter value: trim, drop empty strings. */
function clean(value: string | undefined): string | undefined {
  const trimmed = value?.trim();
  return trimmed ? trimmed : undefined;
}

/** Build filters from a share state (URL) object. */
export function filtersFromShareState(state: AnalyticsShareState | null): AnalyticsFilters {
  if (!state) return EMPTY_FILTERS;
  return {
    from: clean(state.from),
    to: clean(state.to),
    chain: clean(state.chain),
    token: clean(state.token),
  };
}

/** Build the share state that encodes the active filters. */
export function filtersToShareState(filters: AnalyticsFilters): AnalyticsShareState {
  const state: AnalyticsShareState = {};
  if (filters.from) state.from = filters.from;
  if (filters.to) state.to = filters.to;
  if (filters.chain) state.chain = filters.chain;
  if (filters.token) state.token = filters.token;
  return state;
}

/** True when no filter is active. */
export function isFilterActive(filters: AnalyticsFilters): boolean {
  return Boolean(filters.from || filters.to || filters.chain || filters.token);
}

/** Day (UTC) of an ISO timestamp, or null when unparseable. */
function dayOf(iso: string): string | null {
  const time = Date.parse(iso);
  if (Number.isNaN(time)) return null;
  return new Date(time).toISOString().slice(0, 10);
}

/**
 * Apply date-range, chain and token filters to the loaded intents.
 * Date bounds are inclusive and compared at day granularity (UTC).
 * Intents with an unparseable `createdAt` are dropped only when a date
 * bound is active.
 */
export function filterIntents(
  intents: readonly FeedItem[],
  filters: AnalyticsFilters,
): FeedItem[] {
  const from = clean(filters.from);
  const to = clean(filters.to);
  const chain = clean(filters.chain);
  const token = clean(filters.token);

  if (!from && !to && !chain && !token) return intents.slice();

  return intents.filter((intent) => {
    if (chain && intent.srcChain !== chain) return false;
    if (token && intent.dstToken !== token) return false;
    if (from || to) {
      const day = dayOf(intent.createdAt);
      if (!day) return false;
      if (from && day < from) return false;
      if (to && day > to) return false;
    }
    return true;
  });
}

/** Distinct source chains present in the intent set, sorted. */
export function availableChains(intents: readonly FeedItem[]): string[] {
  return Array.from(new Set(intents.map((i) => i.srcChain))).sort();
}

/** Distinct destination tokens present in the intent set, sorted. */
export function availableTokens(intents: readonly FeedItem[]): string[] {
  return Array.from(new Set(intents.map((i) => i.dstToken))).sort();
}
