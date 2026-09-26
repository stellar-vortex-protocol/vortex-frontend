import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import useSWR from "swr";
import { fetcher } from "@/lib/api";
import { swrRetryConfig } from "@/hooks/useRetry";
import type { Quote, QuoteRequest, QuoteErrorType } from "@/lib/types";
import { QUOTE_REFRESH_BACKOFF_MS, QUOTE_REFRESH_MARGIN_MS, QUOTE_TTL_MS } from "@/lib/swapConstants";

export type QuotePhase = "fresh" | "aging" | "stale" | "refreshing" | "locked-for-signing";

export function quotePhase(now: number, fetchedAt: number | null, ttl = QUOTE_TTL_MS, expiresAt?: number | null): QuotePhase {
  if (fetchedAt == null) return "stale";
  const expiry = expiresAt ?? fetchedAt + ttl;
  if (now >= expiry) return "stale";
  if (expiry - now <= QUOTE_REFRESH_MARGIN_MS) return "aging";
  if (now - fetchedAt <= ttl / 2) return "fresh";
  return "aging";
}

function quoteKey(params: QuoteRequest | null): string | null {
  if (!params || !params.srcAmount || parseFloat(params.srcAmount) <= 0)
    return null;
  const search = new URLSearchParams({
    srcChain: params.srcChain,
    srcToken: params.srcToken,
    srcAmount: params.srcAmount,
    dstToken: params.dstToken,
  });
  return `/quote?${search.toString()}`;
}

export function classifyQuoteError(err: unknown): QuoteErrorType {
  if (err instanceof Error) {
    const body = err.message.toLowerCase();
    if (
      body.includes("no solver available") ||
      body.includes("no_solver_available") ||
      body.includes("no solver found")
    ) {
      return { kind: "no-solver", message: err.message };
    }
  }
  return {
    kind: "generic",
    message: err instanceof Error ? err.message : "Failed to fetch quote.",
  };
}

export function useQuote(params: QuoteRequest | null) {
  const [quoteFetchedAt, setQuoteFetchedAt] = useState<number | null>(null);
  const [now, setNow] = useState(() => Date.now());
  const [lockedQuote, setLockedQuote] = useState<Quote | null>(null);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [refreshFailure, setRefreshFailure] = useState<Error | null>(null);
  const failureCount = useRef(0);
  const { data, error, isLoading, mutate } = useSWR<Quote>(quoteKey(params), fetcher, {
    revalidateOnFocus: false,
    isPaused: () => typeof document !== "undefined" && (document.hidden || (typeof navigator !== "undefined" && !navigator.onLine)),
    onSuccess(data) {
      setQuoteFetchedAt(Date.now());
      setRefreshFailure(null);
      failureCount.current = 0;
      return data;
    },
    onErrorRetry(error, _key, _config, revalidate, { retryCount }) {
      // Do not retry on 4xx client errors — they won't self-heal.
      if (error?.status >= 400 && error?.status < 500) return;
      // Cap at 3 retries with exponential back-off: 1s, 2s, 4s.
      if (retryCount >= QUOTE_REFRESH_BACKOFF_MS.length) return;
      setTimeout(() => revalidate({ retryCount }), QUOTE_REFRESH_BACKOFF_MS[retryCount] ?? 8_000);
    },
  });

  useEffect(() => {
    if (data) setQuoteFetchedAt(Date.now());
  }, [data]);

  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, []);

  const expiresAt = useMemo(() => {
    if (!quoteFetchedAt) return null;
    if (data?.expiresAt != null) return typeof data.expiresAt === "number" ? data.expiresAt : Date.parse(data.expiresAt);
    return quoteFetchedAt + QUOTE_TTL_MS;
  }, [data?.expiresAt, quoteFetchedAt]);
  const phase = lockedQuote ? "locked-for-signing" : isRefreshing ? "refreshing" : quotePhase(now, quoteFetchedAt, QUOTE_TTL_MS, expiresAt);
  const refreshQuote = useCallback(async () => {
    if (lockedQuote) return;
    setIsRefreshing(true);
    try { await mutate(); } catch (cause) { const failure = cause instanceof Error ? cause : new Error("Quote refresh failed"); setRefreshFailure(failure); failureCount.current += 1; }
    finally { setIsRefreshing(false); }
  }, [lockedQuote, mutate]);
  useEffect(() => {
    if (phase !== "aging" || lockedQuote) return;
    const timer = window.setTimeout(refreshQuote, Math.max(0, (expiresAt ?? now) - now - QUOTE_REFRESH_MARGIN_MS));
    return () => window.clearTimeout(timer);
  }, [expiresAt, lockedQuote, now, phase, refreshQuote]);
  useEffect(() => {
    const resume = () => { if (!document.hidden && navigator.onLine) void refreshQuote(); };
    window.addEventListener("focus", resume); window.addEventListener("online", resume); document.addEventListener("visibilitychange", resume);
    return () => { window.removeEventListener("focus", resume); window.removeEventListener("online", resume); document.removeEventListener("visibilitychange", resume); };
  }, [refreshQuote]);
  const lockQuote = useCallback(() => { if (data) setLockedQuote(data); return data ?? null; }, [data]);

  const quoteError = error ? classifyQuoteError(error) : null;

  return { quote: lockedQuote ?? data, liveQuote: data, lockedQuote, lockQuote, quoteFetchedAt, expiresAt, phase, secondsRemaining: expiresAt ? Math.max(0, Math.ceil((expiresAt - now) / 1000)) : 0, refreshQuote, refreshFailure, isLoading, error, quoteErrorType: quoteError };
}
