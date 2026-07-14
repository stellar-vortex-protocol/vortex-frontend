import useSWR from "swr";
import { fetcher } from "@/lib/api";
import type { Quote, QuoteRequest } from "@/lib/types";

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

export function useQuote(params: QuoteRequest | null) {
  const { data, error, isLoading } = useSWR<Quote>(quoteKey(params), fetcher, {
    revalidateOnFocus: false,
  });

  return { quote: data, isLoading, error };
}
