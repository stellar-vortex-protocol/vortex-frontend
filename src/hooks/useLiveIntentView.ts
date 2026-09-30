import { useEffect, useRef, useState } from "react";
import { useWebSocket } from "./useWebSocket";
import { parseFeedItemFrame } from "@/lib/realtime/quarantine";
import { useIntentStore, type IntentView } from "@/store/intents";
import type { FeedItem } from "@/lib/types";

const WS_URL = process.env["NEXT_PUBLIC_WS_URL"] ?? null;
const BACKFILL_MIN_INTERVAL_MS = 5_000;

type RestSource = {
  items: FeedItem[];
  mutate?: () => Promise<unknown>;
};

/**
 * Wires one view of the intent store: ingests the REST snapshot and every
 * validated WebSocket frame, and on each reconnect revalidates the REST key
 * to backfill anything missed while offline. Backfills are deduplicated (one
 * in flight at a time, plus SWR's own dedupe), rate-limited and dropped on
 * unmount. Existing rows are never cleared while catching up.
 */
export function useLiveIntentView(view: IntentView, rest: RestSource, enabled = true) {
  const ingest = useIntentStore((s) => s.ingest);
  const { status, lastMessage, reconnectCount } = useWebSocket<FeedItem>(
    enabled ? WS_URL : null,
    { parse: parseFeedItemFrame },
  );
  const [isCatchingUp, setIsCatchingUp] = useState(false);
  const inFlightRef = useRef(false);
  const lastBackfillRef = useRef(0);
  const mutateRef = useRef(rest.mutate);
  mutateRef.current = rest.mutate;

  useEffect(() => {
    if (enabled && rest.items.length > 0) ingest(rest.items, "rest", view);
  }, [enabled, rest.items, ingest, view]);

  useEffect(() => {
    if (lastMessage) ingest([lastMessage], "ws", view);
  }, [lastMessage, ingest, view]);

  useEffect(() => {
    const revalidate = mutateRef.current;
    if (!reconnectCount || !revalidate || inFlightRef.current) return;
    const now = Date.now();
    if (now - lastBackfillRef.current < BACKFILL_MIN_INTERVAL_MS) return;
    lastBackfillRef.current = now;
    inFlightRef.current = true;
    let cancelled = false;
    setIsCatchingUp(true);
    revalidate()
      .catch(() => undefined)
      .finally(() => {
        inFlightRef.current = false;
        if (!cancelled) setIsCatchingUp(false);
      });
    return () => {
      cancelled = true;
    };
  }, [reconnectCount]);

  return { isLive: status === "open", isCatchingUp };
}
