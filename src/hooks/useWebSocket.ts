import { useEffect, useRef, useState } from "react";

export type WebSocketStatus =
  | "connecting"
  | "open"
  | "closed"
  | "error"
  | "unavailable";

const INITIAL_RECONNECT_DELAY_MS = 3000;
const MAX_RECONNECT_DELAY_MS = 60000;
const MAX_RECONNECTION_ATTEMPTS = 10;
const JITTER_FACTOR = 0.2; // ±20% jitter

/**
 * Adds randomized jitter to a delay to avoid thundering herd problem.
 * Returns a delay within ±20% of the original value.
 */
function addJitter(delay: number, jitterFactor: number = JITTER_FACTOR): number {
  const jitterRange = delay * jitterFactor;
  const jitter = (Math.random() - 0.5) * 2 * jitterRange;
  return Math.max(0, delay + jitter);
}

/**
 * Generic JSON-over-WebSocket subscription with abuse-resistant auto-reconnect.
 * Features:
 * - Exponential backoff with jitter to avoid thundering herd
 * - Maximum reconnection attempts to prevent infinite retries
 * - Focus-aware reconnection (resets attempt counter on tab visibility)
 * - Passes null url to tear down connection and stay idle
 *
 * After max attempts, status becomes "unavailable" and manual reconnect is required.
 */
export function useWebSocket<T>(url: string | null) {
  const [status, setStatus] = useState<WebSocketStatus>("connecting");
  const [lastMessage, setLastMessage] = useState<T | null>(null);
  const socketRef = useRef<WebSocket | null>(null);
  const attemptsRef = useRef(0);

  useEffect(() => {
    if (!url) {
      setStatus("closed");
      return;
    }

    let socket: WebSocket | null = null;
    let reconnectTimer: ReturnType<typeof setTimeout> | null = null;
    let cancelled = false;

    const connect = () => {
      // Check if we've exceeded max reconnection attempts
      if (attemptsRef.current >= MAX_RECONNECTION_ATTEMPTS) {
        setStatus("unavailable");
        return;
      }

      setStatus("connecting");
      socket = new WebSocket(url);
      socketRef.current = socket;

      socket.onopen = () => {
        if (cancelled) return;
        // A successful connection clears the accumulated backoff and attempts
        // so a later outage starts over at the initial delay.
        attemptsRef.current = 0;
        setStatus("open");
      };

      socket.onmessage = (event) => {
        if (cancelled) return;
        try {
          setLastMessage(JSON.parse(event.data) as T);
        } catch {
          // Ignore malformed frames rather than crashing the feed.
        }
      };

      socket.onerror = () => {
        if (!cancelled) setStatus("error");
      };

      socket.onclose = () => {
        if (cancelled) return;

        if (attemptsRef.current >= MAX_RECONNECTION_ATTEMPTS) {
          setStatus("unavailable");
          return;
        }

        setStatus("closed");
        const baseDelay = Math.min(
          INITIAL_RECONNECT_DELAY_MS * 2 ** attemptsRef.current,
          MAX_RECONNECT_DELAY_MS,
        );
        const delayWithJitter = addJitter(baseDelay);
        attemptsRef.current += 1;
        reconnectTimer = setTimeout(connect, delayWithJitter);
      };
    };

    connect();

    const handleVisibilityChange = () => {
      if (document.visibilityState !== "visible") return;

      const s = socketRef.current;
      if (s && s.readyState === WebSocket.CLOSED) {
        // Reset attempt counter when user returns to tab - treat as fresh signal
        attemptsRef.current = 0;
        connect();
      } else if (status === "unavailable") {
        // Allow retry from unavailable state when user focuses tab
        attemptsRef.current = 0;
        connect();
      }
    };

    document.addEventListener("visibilitychange", handleVisibilityChange);

    return () => {
      cancelled = true;
      document.removeEventListener("visibilitychange", handleVisibilityChange);
      if (reconnectTimer) clearTimeout(reconnectTimer);
      socket?.close();
    };
  }, [url, status]);

  return { status, lastMessage };
}
