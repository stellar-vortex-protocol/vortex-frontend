import { useEffect, useState } from "react";
import useSWR from "swr";
import { fetcher } from "@/lib/api";
import { swrRetryConfig } from "@/hooks/useRetry";
import type { Quote, QuoteRequest, QuoteErrorType } from "@/lib/types";

function quoteKey(params: QuoteRequest | null): string | null {
  if (!params || !params.srcAmount || parseFloat(params.srcAmount) <= 0) return null;
  const search = new URLSearchParams({
    srcChain: params.srcChain,
    srcToken: params.srcToken,
    srcAmount: params.srcAmount,
    dstToken: params.dstToken,
  });
  return `/quote?${search.toString()}`;
}

function classifyQuoteError(err: unknown): QuoteErrorType {
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
  return { kind: "generic", message: err instanceof Error ? err.message : "Failed to fetch quote." };
}

export function useQuote(params: QuoteRequest | null) {
  const [quoteFetchedAt, setQuoteFetchedAt] = useState<number | null>(null);
  const { data, error, isLoading } = useSWR<Quote>(quoteKey(params), fetcher, {
    revalidateOnFocus: false,
    ...swrRetryConfig,
  });

  useEffect(() => {
    if (data) setQuoteFetchedAt(Date.now());
  }, [data]);

  const quoteError = error ? classifyQuoteError(error) : null;

  return { quote: data, quoteFetchedAt, isLoading, error, quoteErrorType: quoteError };
}
