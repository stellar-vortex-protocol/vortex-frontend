import useSWR from "swr";
import { fetcher } from "@/lib/api";
import { swrRetryConfig } from "@/hooks/useRetry";
import type { FeedItem } from "@/lib/types";

// refreshInterval is intentionally 0 (disabled) because useIntentFeed layers
// a WebSocket subscription on top of this REST snapshot. The snapshot seeds
// the initial list; the socket keeps it live. Polling would be redundant and
// would hammer the relay endpoint unnecessarily.
//
// dedupingInterval is set to match the former polling interval (8 s) so that
// rapid re-mounts (e.g. strict-mode double-invocation) still share a single
// in-flight request.
export function useActivityFeed() {
  const { data, error, isLoading } = useSWR<FeedItem[]>("/intents/feed", fetcher, {
    refreshInterval: 0,
    dedupingInterval: 8_000,
    ...swrRetryConfig,
  });

  return { items: data ?? [], isLoading, error };
}
