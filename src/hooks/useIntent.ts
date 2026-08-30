import useSWR from "swr";
import { fetcher } from "@/lib/api";
import type { IntentDetail } from "@/lib/types";

const POLL_INTERVAL_MS = 5_000;
const TERMINAL_STATUSES = new Set(["filled", "failed"]);

// Single-intent detail fetch. The WebSocket feed only carries FeedItem
// summaries (not full IntentDetail), so per-intent live updates are done via
// SWR polling instead of subscribing to the shared socket. Polling stops
// once the intent reaches a terminal status to avoid wasted requests.
//
// revalidateOnFocus: true (default) is kept because a user may tab away,
// wait for a fill, and tab back — which should show the updated status.
//
// dedupingInterval: 5 s prevents rapid focus events from firing duplicate
// requests during the short window after the initial load.
export function useIntent(id: string | null) {
  const { data, error, isLoading } = useSWR<IntentDetail>(
    id ? `/intents/${id}` : null,
    fetcher,
    {
      refreshInterval: (latest) =>
        latest && TERMINAL_STATUSES.has(latest.status) ? 0 : POLL_INTERVAL_MS,
      dedupingInterval: 5_000,
      revalidateOnFocus: true,
    },
  );

  return { intent: data, isLoading, error };
}
