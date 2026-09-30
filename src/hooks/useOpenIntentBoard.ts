import { useCallback, useEffect, useMemo, useState } from "react";
import { useOpenIntents } from "./useOpenIntents";
import { useWebSocket } from "./useWebSocket";
import {
  applyEvents,
  filterAndSortIntents,
  isOpenIntentEvent,
  type BoardFilters,
  type OpenIntentEvent,
} from "@/lib/openIntentBoard";
import type { OpenIntent } from "@/lib/types";

const WS_URL = process.env["NEXT_PUBLIC_WS_URL"] ?? null;
const MAX_EVENTS = 500;

function diffCount(a: readonly OpenIntent[], b: readonly OpenIntent[]): number {
  const ids = new Set(a.map((i) => i.id));
  const other = new Set(b.map((i) => i.id));
  let n = 0;
  ids.forEach((id) => { if (!other.has(id)) n++; });
  other.forEach((id) => { if (!ids.has(id)) n++; });
  return n;
}

/**
 * Open-intent board data: REST snapshot (`/intents/open`, 5 s poll) merged
 * with `intent.open` / `intent.closed` events from the shared WebSocket.
 *
 * While `paused` (pointer hovering / focus inside the board) the displayed
 * rows are frozen so they never jump under the cursor; `pendingCount` reports
 * how many rows changed meanwhile and `flush()` applies them on demand.
 *
 * `clockOffsetMs` (server − client) is derived from event `serverTime`
 * stamps so countdowns tolerate local clock drift.
 */
export function useOpenIntentBoard(filters: BoardFilters, paused: boolean) {
  const { intents: rest, isLoading, error } = useOpenIntents();
  const { status, lastMessage } = useWebSocket<unknown>(WS_URL);
  const [events, setEvents] = useState<OpenIntentEvent[]>([]);
  const [clockOffsetMs, setClockOffsetMs] = useState(0);
  const [frozen, setFrozen] = useState<OpenIntent[] | null>(null);

  // A fresh REST snapshot supersedes the events received before it.
  // (`rest` is a new [] on every render until data arrives — no-op then.)
  useEffect(() => setEvents((prev) => (prev.length ? [] : prev)), [rest]);

  useEffect(() => {
    if (!isOpenIntentEvent(lastMessage)) return;
    setEvents((prev) => [...prev.slice(-(MAX_EVENTS - 1)), lastMessage]);
    if (lastMessage.serverTime) {
      const server = Date.parse(lastMessage.serverTime);
      if (Number.isFinite(server)) setClockOffsetMs(server - Date.now());
    }
  }, [lastMessage]);

  const merged = useMemo(() => applyEvents(rest, events), [rest, events]);

  useEffect(() => {
    if (paused) setFrozen((f) => f ?? merged);
    else setFrozen(null);
    // Only the pause transition should (re)capture the snapshot.
  }, [paused]); // eslint-disable-line react-hooks/exhaustive-deps -- `merged` intentionally excluded: it is captured once per pause

  const source = frozen ?? merged;
  const { chain, token, minUsd } = filters;
  const intents = useMemo(
    () => filterAndSortIntents(source, { chain, token, minUsd }),
    [source, chain, token, minUsd],
  );

  const flush = useCallback(() => setFrozen((f) => (f ? merged : f)), [merged]);

  return {
    intents,
    all: merged,
    pendingCount: frozen ? diffCount(frozen, merged) : 0,
    flush,
    isLoading,
    error,
    isLive: status === "open",
    clockOffsetMs,
  };
}
