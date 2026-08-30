/**
 * useRetry — shared SWR retry configuration for API call resilience.
 *
 * Provides a consistent `onErrorRetry` handler that:
 * - Does NOT retry 4xx client errors (they won't self-heal and reflect a
 *   genuine problem with the request).
 * - Retries up to MAX_RETRIES times on 5xx / network errors with exponential
 *   back-off: 1 s, 2 s, 4 s … (capped by MAX_RETRIES).
 *
 * Integration point: `useAcceptIntent`'s `accept()` call benefits from this
 * hook to handle transient network blips without requiring the solver to
 * manually retry — see useAcceptIntent.ts for the wiring.
 *
 * Usage with SWR (hook form):
 *   const { onErrorRetry } = useRetry();
 *   useSWR(key, fetcher, { onErrorRetry });
 *
 * Usage with SWR (static form, usable outside components):
 *   import { swrRetryConfig } from "@/hooks/useRetry";
 *   useSWR(key, fetcher, { ...swrRetryConfig });
 *
 * Usage as a plain async wrapper (non-SWR):
 *   const { withRetry } = useRetry();
 *   await withRetry(() => acceptIntent(id, address));
 *
 * NOTE: Signature-requiring flows (createIntent → sign → submitIntent) must
 * NEVER be auto-retried — a failed or rejected signature should not silently
 * replay without fresh user consent.
 */

import { useCallback } from "react";
import type { SWRConfiguration } from "swr";

export const MAX_RETRIES = 3;
/** Base delay in milliseconds; doubles on each attempt (exponential back-off). */
export const BASE_DELAY_MS = 1_000;

/** Returns true if the error represents a 4xx client error that should not be retried. */
export function isClientError(err: unknown): boolean {
  if (err && typeof err === "object" && "status" in err) {
    const status = (err as { status: number }).status;
    return status >= 400 && status < 500;
  }
  return false;
}

export type RetryOptions = {
  /** Maximum number of retry attempts. Defaults to MAX_RETRIES. */
  maxRetries?: number;
  /** Base delay in ms for exponential back-off. Defaults to BASE_DELAY_MS. */
  baseDelayMs?: number;
};

export type UseRetryReturn = {
  /**
   * SWR-compatible `onErrorRetry` handler. Pass directly to `useSWR` options.
   * Respects the 4xx no-retry rule and the configured attempt cap.
   */
  onErrorRetry: NonNullable<SWRConfiguration["onErrorRetry"]>;

  /**
   * Wraps an async function with exponential-backoff retry logic.
   * Suitable for imperative call sites (e.g. useAcceptIntent's accept()).
   * Does not retry 4xx client errors.
   */
  withRetry: <T>(fn: () => Promise<T>) => Promise<T>;
};

/**
 * Stable, module-level `onErrorRetry` for SWR hooks.
 * Identical behaviour to the hook form but callable outside React components
 * (e.g. directly in `useSWR` option objects at the top level of a hook file).
 */
export function makeOnErrorRetry(
  maxRetries = MAX_RETRIES,
  baseDelayMs = BASE_DELAY_MS,
): NonNullable<SWRConfiguration["onErrorRetry"]> {
  return (error, _key, _config, revalidate, { retryCount }) => {
    if (isClientError(error)) return;
    if (retryCount >= maxRetries) return;
    setTimeout(() => revalidate({ retryCount }), baseDelayMs * 2 ** retryCount);
  };
}

/** Drop-in SWR config spread for standard retry behaviour. */
export const swrRetryConfig: Pick<SWRConfiguration, "onErrorRetry"> = {
  onErrorRetry: makeOnErrorRetry(),
};

export function useRetry(options: RetryOptions = {}): UseRetryReturn {
  const maxRetries = options.maxRetries ?? MAX_RETRIES;
  const baseDelayMs = options.baseDelayMs ?? BASE_DELAY_MS;

  const onErrorRetry: NonNullable<SWRConfiguration["onErrorRetry"]> = useCallback(
    (error, _key, _config, revalidate, { retryCount }) => {
      // Never retry client errors.
      if (isClientError(error)) return;
      // Cap at maxRetries.
      if (retryCount >= maxRetries) return;
      // Exponential back-off.
      setTimeout(() => revalidate({ retryCount }), baseDelayMs * 2 ** retryCount);
    },
    [maxRetries, baseDelayMs],
  );

  const withRetry = useCallback(
    async <T>(fn: () => Promise<T>): Promise<T> => {
      let lastError: unknown;
      for (let attempt = 0; attempt <= maxRetries; attempt++) {
        try {
          return await fn();
        } catch (err) {
          lastError = err;
          // Do not retry 4xx client errors.
          if (isClientError(err)) throw err;
          // If we've exhausted attempts, throw.
          if (attempt === maxRetries) break;
          // Wait with exponential back-off before next attempt.
          await new Promise<void>(resolve =>
            setTimeout(resolve, baseDelayMs * 2 ** attempt),
          );
        }
      }
      throw lastError;
    },
    [maxRetries, baseDelayMs],
  );

  return { onErrorRetry, withRetry };
}
