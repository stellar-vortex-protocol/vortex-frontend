import useSWR from "swr";
import { endpoint } from "@/lib/api";
import { feedItemListSchema } from "@/lib/schemas";

const fetcher = endpoint(feedItemListSchema);
import type { FeedItem } from "@/lib/types";

// No polling needed — useLiveIntents layers a WebSocket subscription on top
// of this REST snapshot. The snapshot seeds the initial list; live updates
// arrive over the socket. Polling would be redundant.
//
// dedupingInterval is set to 8 s (matching useActivityFeed's former poll
// interval) so rapid re-mounts share one in-flight request without hitting
// the relay repeatedly.
export function useIntents() {
  const { data, error, isLoading, mutate } = useSWR<FeedItem[]>("/intents", fetcher, {
    refreshInterval: 0,
    dedupingInterval: 8_000,
  });

  return { intents: data ?? [], isLoading, error, mutate };
}
