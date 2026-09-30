import useSWR from "swr";
import { endpoint } from "@/lib/api";
import { feedItemListSchema } from "@/lib/schemas";

const fetcher = endpoint(feedItemListSchema);
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
  const { data, error, isLoading, mutate } = useSWR<FeedItem[]>("/intents/feed", fetcher, {
    refreshInterval: 0,
    dedupingInterval: 8_000,
  });

  return { items: data ?? [], isLoading, error, mutate };
}
