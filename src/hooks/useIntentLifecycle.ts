import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import useSWR from "swr";
import { fetcher } from "@/lib/api";
import { swrRetryConfig } from "@/hooks/useRetry";
import { useRealtimeStatus, useRealtimeTopic } from "@/hooks/useRealtime";
import {
  deriveTrackerSteps,
  LAST_INTENT_EVENT,
  loadLastSubmittedIntent,
  mergeIntentUpdate,
  saveLastSubmittedIntent,
  type ObservedAt,
  type TrackerView,
} from "@/lib/intentLifecycle";
import type { FeedItem, IntentDetail } from "@/lib/types";

const WS_URL = process.env["NEXT_PUBLIC_WS_URL"] ?? null;
const POLL_BASE_MS = 5_000;
const POLL_MAX_MS = 60_000;

/**
 * Live lifecycle of one intent: REST detail merged with WebSocket updates
 * from the shared realtime connection. When the socket isn't open, falls
 * back to polling with exponential backoff (5 s → 60 s) until terminal.
 */
export function useIntentLifecycle(id: string | null): {
  intent: IntentDetail | undefined;
  view: TrackerView | null;
  isLoading: boolean;
  error: unknown;
} {
  const { status: wsStatus } = useRealtimeStatus(id ? WS_URL : null);
  const [live, setLive] = useState<FeedItem | undefined>(undefined);
  const [observed, setObserved] = useState<ObservedAt>({});
  const [now, setNow] = useState(() => Date.now());
  const pollCount = useRef(0);
  const terminalRef = useRef(false);

  // Reset when switching intents.
  useEffect(() => {
    setLive(undefined);
    setObserved({});
    pollCount.current = 0;
    terminalRef.current = false;
  }, [id]);

  const refreshInterval = useCallback(() => {
    if (terminalRef.current || wsStatus === "open") return 0;
    const delay = Math.min(POLL_BASE_MS * 2 ** pollCount.current, POLL_MAX_MS);
    pollCount.current += 1;
    return delay;
  }, [wsStatus]);

  const { data, error, isLoading } = useSWR<IntentDetail>(id ? `/intents/${id}` : null, fetcher, {
    refreshInterval,
    dedupingInterval: 2_000,
    ...swrRetryConfig,
  });

  useRealtimeTopic<FeedItem>(
    id ? WS_URL : null,
    "intents",
    (msg) => {
      setLive((prev) => mergeIntentUpdate(prev, msg));
      setObserved((prev) =>
        prev[msg.status] ? prev : { ...prev, [msg.status]: new Date().toISOString() },
      );
    },
    (msg) => msg.id === id,
  );

  const intent = useMemo<IntentDetail | undefined>(() => {
    if (!data) return undefined;
    if (!live) return data;
    const merged = mergeIntentUpdate<FeedItem>(data, { ...data, ...live });
    return { ...data, status: merged.status };
  }, [data, live]);

  const view = useMemo(
    () => (intent ? deriveTrackerSteps(intent, now, observed) : null),
    [intent, now, observed],
  );
  terminalRef.current = view?.isTerminal ?? false;

  // Tick once a second for the deadline countdown while in flight.
  const inFlight = view ? !view.isTerminal : false;
  useEffect(() => {
    if (!inFlight) return;
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, [inFlight]);

  return { intent, view, isLoading, error };
}

/** The last submitted intent id (persisted so a reload mid-flight keeps tracking). */
export function useLastSubmittedIntent(): [string | null, (id: string | null) => void] {
  const [id, setId] = useState<string | null>(null);
  useEffect(() => {
    const sync = () => setId(loadLastSubmittedIntent());
    sync();
    window.addEventListener(LAST_INTENT_EVENT, sync);
    window.addEventListener("storage", sync);
    return () => {
      window.removeEventListener(LAST_INTENT_EVENT, sync);
      window.removeEventListener("storage", sync);
    };
  }, []);
  return [id, saveLastSubmittedIntent];
}
