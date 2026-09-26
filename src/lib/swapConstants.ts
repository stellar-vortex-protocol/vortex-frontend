/**
 * Swap-flow constants and pure helpers, kept out of `SwapCard` so they are
 * defined once and unit-testable.
 */

/** Default slippage tolerance, in percent. */
export const DEFAULT_SLIPPAGE_PCT = 0.5;

/** Price impact above this (percent) shows a warning before swapping. */
export const HIGH_PRICE_IMPACT_THRESHOLD_PCT = 3;

/**
 * A quote older than this is stale and must refresh before a submit is
 * allowed. 30 s: long enough to review a quote and sign, short enough that the
 * user never signs against prices more than half a minute old. (The file
 * previously declared both 30 s and 60 s; the shorter value is the safer one
 * for a financial quote.)
 */
export const STALE_QUOTE_THRESHOLD_MS = 30_000;

/** How long the "quote changed" delta indicator stays on screen. */
export const QUOTE_DELTA_TTL_MS = 4_000;

/** Seconds-remaining at or below which the "quote expires in" hint shows. */
export const QUOTE_EXPIRY_WARNING_SECONDS = 5;

export type QuoteFreshness = {
  isStale: boolean;
  /** Whole seconds until the quote goes stale; `null` when there is no quote. */
  expiresInSeconds: number | null;
};

/** Whether a quote fetched at `fetchedAt` is stale at time `now` (both ms). */
export function quoteFreshness(
  fetchedAt: number | null,
  now: number,
  thresholdMs: number = STALE_QUOTE_THRESHOLD_MS,
): QuoteFreshness {
  if (fetchedAt === null) return { isStale: false, expiresInSeconds: null };
  const ageMs = Math.max(0, now - fetchedAt);
  return {
    isStale: ageMs >= thresholdMs,
    expiresInSeconds: Math.max(0, Math.ceil((thresholdMs - ageMs) / 1000)),
  };
}
