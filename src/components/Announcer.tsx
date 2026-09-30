"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";

export type Politeness = "polite" | "assertive";

export interface AnnounceOptions {
  /** Live-region politeness. Defaults to "polite". */
  politeness?: Politeness;
  /** Coalescing key: messages sharing a key within `coalesceMs` collapse into the latest. */
  key?: string;
  /** Window in which messages with the same `key` are coalesced. Defaults to 0 (no coalescing). */
  coalesceMs?: number;
  /** Minimum interval between announcements from the same source. Defaults to 0. */
  throttleMs?: number;
  /** Logical source used for per-source rate limiting. Defaults to "default". */
  source?: string;
}

export interface AnnouncerApi {
  announce: (message: string, options?: AnnounceOptions) => void;
}

const AnnouncerContext = createContext<AnnouncerApi | null>(null);

const DEFAULT_THROTTLE_MS = 500;
const MAX_QUEUE = 20;

interface QueueEntry {
  message: string;
  politeness: Politeness;
  key?: string;
  coalesceMs: number;
  source: string;
  enqueuedAt: number;
}

/**
 * Central screen-reader announcer. Renders two persistent live regions
 * (polite + assertive) and exposes `useAnnounce()` for the rest of the app.
 *
 * Policy (see docs/accessibility.md):
 * - feed inserts -> batched summaries, polite
 * - quote changes -> once per settle, polite
 * - errors -> assertive
 * - success -> polite
 * - connectivity changes -> polite
 * - per-source throttling prevents flooding
 */
export function AnnouncerProvider({ children }: { children: ReactNode }) {
  const [polite, setPolite] = useState("");
  const [assertive, setAssertive] = useState("");

  const queueRef = useRef<QueueEntry[]>([]);
  const lastBySourceRef = useRef<Map<string, number>>(new Map());
  const lastByKeyRef = useRef<Map<string, number>>(new Map());
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const flushRef = useRef<() => void>(() => {});

  const flush = useCallback(() => {
    timerRef.current = null;
    const queue = queueRef.current;
    if (queue.length === 0) return;

    // Highest priority first (assertive), then FIFO.
    queue.sort((a, b) => {
      if (a.politeness === b.politeness) return a.enqueuedAt - b.enqueuedAt;
      return a.politeness === "assertive" ? -1 : 1;
    });

    const next = queue.shift();
    if (!next) return;

    const now = Date.now();
    lastBySourceRef.current.set(next.source, now);
    if (next.key) lastByKeyRef.current.set(next.key, now);

    if (next.politeness === "assertive") {
      setAssertive(next.message);
    } else {
      setPolite(next.message);
    }

    if (queue.length > 0) {
      timerRef.current = setTimeout(flushRef.current, DEFAULT_THROTTLE_MS);
    }
  }, []);

  useEffect(() => {
    flushRef.current = flush;
  }, [flush]);

  const announce = useCallback(
    (message: string, options: AnnounceOptions = {}) => {
      const trimmed = message.trim();
      if (!trimmed) return;

      const politeness = options.politeness ?? "polite";
      const source = options.source ?? "default";
      const coalesceMs = options.coalesceMs ?? 0;
      const throttleMs = options.throttleMs ?? DEFAULT_THROTTLE_MS;
      const now = Date.now();

      // Per-source rate limiting.
      const lastSource = lastBySourceRef.current.get(source) ?? 0;
      if (now - lastSource < throttleMs) return;

      // Coalescing: replace a pending entry with the same key.
      if (options.key && coalesceMs > 0) {
        const lastKey = lastByKeyRef.current.get(options.key) ?? 0;
        if (now - lastKey < coalesceMs) {
          const existing = queueRef.current.find((e) => e.key === options.key);
          if (existing) {
            existing.message = trimmed;
            existing.enqueuedAt = now;
            return;
          }
        }
      }

      queueRef.current.push({
        message: trimmed,
        politeness,
        key: options.key,
        coalesceMs,
        source,
        enqueuedAt: now,
      });

      if (queueRef.current.length > MAX_QUEUE) {
        queueRef.current.splice(0, queueRef.current.length - MAX_QUEUE);
      }

      if (timerRef.current === null) {
        timerRef.current = setTimeout(flushRef.current, 0);
      }
    },
    [],
  );

  useEffect(() => {
    return () => {
      if (timerRef.current !== null) clearTimeout(timerRef.current);
    };
  }, []);

  const api = useMemo<AnnouncerApi>(() => ({ announce }), [announce]);

  return (
    <AnnouncerContext.Provider value={api}>
      {children}
      <div
        aria-live="polite"
        aria-atomic="true"
        role="status"
        className="sr-only"
        data-testid="announcer-polite"
      >
        {polite}
      </div>
      <div
        aria-live="assertive"
        aria-atomic="true"
        role="alert"
        className="sr-only"
        data-testid="announcer-assertive"
      >
        {assertive}
      </div>
    </AnnouncerContext.Provider>
  );
}

export function useAnnounce(): AnnouncerApi["announce"] {
  const ctx = useContext(AnnouncerContext);
  if (!ctx) {
    throw new Error("useAnnounce must be used within an AnnouncerProvider");
  }
  return ctx.announce;
}
