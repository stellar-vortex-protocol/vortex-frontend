import type { SWRConfiguration } from "swr";
import { isAbortError, toClientError } from "./api";
import { secureLogger } from "./secureLogging";

export const SWR_MAX_RETRIES = 4;
export const SWR_BASE_DELAY_MS = 1_000;
export const SWR_MAX_DELAY_MS = 30_000;

/** 4xx errors are not retried, except 408 Request Timeout and 429 Too Many Requests. */
export function shouldRetry(err: unknown): boolean {
  if (isAbortError(err)) return false;
  const e = toClientError(err);
  if (e.kind === "validation") return false;
  if (e.kind !== "http" || e.status === undefined) return true;
  if (e.status === 408 || e.status === 429) return true;
  return e.status >= 500;
}

/** Exponential backoff with full jitter, honouring `Retry-After` when present. */
export function retryDelay(err: unknown, retryCount: number, random = Math.random): number {
  const retryAfter = toClientError(err).retryAfterMs;
  if (retryAfter !== undefined) return Math.min(retryAfter, SWR_MAX_DELAY_MS);
  const cap = Math.min(SWR_BASE_DELAY_MS * 2 ** retryCount, SWR_MAX_DELAY_MS);
  return Math.round(cap / 2 + random() * (cap / 2));
}

export const onErrorRetry: NonNullable<SWRConfiguration["onErrorRetry"]> = (
  error,
  _key,
  _config,
  revalidate,
  { retryCount },
) => {
  if (!shouldRetry(error) || retryCount >= SWR_MAX_RETRIES) return;
  setTimeout(() => revalidate({ retryCount }), retryDelay(error, retryCount));
};

const fetchCounts = new Map<string, number>();

/** Dev-only: counts fetches per key to surface over-fetching. */
export function logFetch(key: unknown) {
  if (process.env["NODE_ENV"] === "production") return;
  const k = typeof key === "string" ? key : JSON.stringify(key);
  const n = (fetchCounts.get(k) ?? 0) + 1;
  fetchCounts.set(k, n);
  if (n > 1 && n % 5 === 0) secureLogger.warn("SWR refetch count high", { key: k, count: n });
}

export const baseSWRConfig: SWRConfiguration = {
  onErrorRetry,
  dedupingInterval: 5_000,
  revalidateOnFocus: true,
  focusThrottleInterval: 30_000,
  shouldRetryOnError: true,
};
