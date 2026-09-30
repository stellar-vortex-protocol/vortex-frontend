import { useEffect, useState } from "react";
import useSWR from "swr";
import { endpoint, fetcher } from "@/lib/api";
import { intentDetailSchema } from "@/lib/schemas";
import { swrRetryConfig } from "@/hooks/useRetry";
import { useWebSocket } from "@/hooks/useWebSocket";
import type { FeedItem, IntentDetail, IntentStatus } from "@/lib/types";

const WS_URL = process.env["NEXT_PUBLIC_WS_URL"] ?? null;

/** Statuses where the intent will never change again — stop refreshing. */
const TERMINAL_STATUSES = new Set<IntentStatus>(["filled", "failed"]);

/**
 * Fetches a single intent's detail and keeps it live via two mechanisms:
 *
 * 1. **SWR polling** — `refreshInterval: 5_000` while the intent is in a
 *    non-terminal state. Once `filled` or `failed` is observed the interval
 *    drops to 0 so we stop issuing unnecessary requests.
 *
 * 2. **WebSocket overlay** — subscribes to the shared `NEXT_PUBLIC_WS_URL`
 *    feed (same socket used by `useLiveIntents` / `useIntentFeed`).  Because
 *    the backend broadcasts every status change as a `FeedItem`, we filter
 *    client-side by `id` and merge any matching message on top of the SWR
 *    data.  This gives sub-second updates when the socket is connected, with
 *    polling as an automatic fallback when it isn't.
 *
 * PR note: per-intent WebSocket filtering is done client-side (not a new
 * subscription shape) because the existing backend broadcasts the full feed
 * to all subscribers — no server-side change was needed. If the backend later
 * gains per-intent rooms/topics we can swap in a targeted URL here.
 *
 * `revalidateOnFocus: true` is kept so a user who tabs away and back always
 * gets a fresh snapshot even if polling happened to be paused.
 */
export function useIntent(id: string | null) {
  const [isTerminal, setIsTerminal] = useState(false);

  const { data, error, isLoading, mutate } = useSWR<IntentDetail>(
    id ? `/intents/${id}` : null,
    fetcher,
    {
      // Poll every 5 s while the intent is live; stop once terminal.
      refreshInterval: isTerminal ? 0 : 5_000,
      dedupingInterval: 5_000,
      revalidateOnFocus: true,
    },
  );

  // Stop polling once the REST snapshot itself reaches a terminal status.
  useEffect(() => {
    if (data?.status && TERMINAL_STATUSES.has(data.status)) {
      setIsTerminal(true);
    }
  }, [data?.status]);

  // WebSocket overlay — filter the shared feed to this intent's id.
  const { status: wsStatus, lastMessage } = useWebSocket<FeedItem>(
    // Stay idle once terminal — no point keeping the socket open for this intent.
    id && !isTerminal ? WS_URL : null,
  );

  useEffect(() => {
    if (!lastMessage || lastMessage.id !== id) return;

    // Merge the incoming FeedItem fields on top of the current IntentDetail.
    // FeedItem is a subset of IntentDetail so this is safe.
    mutate(
      (current) =>
        current
          ? { ...current, ...lastMessage }
          : undefined,
      // Don't re-fetch from the server — we already have the update.
      { revalidate: false },
    );

    if (TERMINAL_STATUSES.has(lastMessage.status)) {
      setIsTerminal(true);
    }
  }, [lastMessage, id, mutate]);

  return {
    intent: data,
    isLoading,
    error,
    isLive: wsStatus === "open",
  };
}
