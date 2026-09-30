"use client";

import useSWR from "swr";
import { fetcher } from "@/lib/api";
import { FALLBACK_REGISTRY, validateRegistryPayload, type RegistrySnapshot } from "@/lib/marketData";

const REFRESH_MS = 30_000;

export function useMarketRegistry() {
  const { data, error, isLoading, mutate } = useSWR<RegistrySnapshot>("/config/assets", async (url) => {
    try { return validateRegistryPayload(await fetcher<unknown>(url)); }
    catch (cause) { console.warn("[market-registry] invalid relay payload", cause instanceof Error ? cause.message : "unknown"); return FALLBACK_REGISTRY; }
  }, { fallbackData: FALLBACK_REGISTRY, refreshInterval: REFRESH_MS, revalidateOnFocus: true });
  return { registry: data ?? FALLBACK_REGISTRY, error, isLoading, refresh: mutate, isStale: Boolean(error) || (data?.pricesAsOf ? Date.now() - Date.parse(data.pricesAsOf) > REFRESH_MS * 2 : false) };
}

export function useTokenLookup(registry: RegistrySnapshot, chainId: string, symbol: string) {
  return registry.srcTokens[chainId]?.find((token) => token.symbol === symbol) ?? registry.dstTokens.find((token) => token.symbol === symbol);
}
