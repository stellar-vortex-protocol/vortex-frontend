import { useEffect, useRef, useState } from "react";

export type WebSocketStatus = "connecting" | "open" | "closed" | "error";

const INITIAL_RECONNECT_DELAY_MS = 3000;
const MAX_RECONNECT_DELAY_MS = 60000;

// Generic JSON-over-WebSocket subscription with auto-reconnect. Passing a
// null url tears down any existing connection and stays idle — useful for
// gating the connection behind a feature flag or missing config.
export function useWebSocket<T>(url: string | null) {
  const [status, setStatus] = useState<WebSocketStatus>("connecting");
  const [lastMessage, setLastMessage] = useState<T | null>(null);
  const socketRef = useRef<WebSocket | null>(null);

  useEffect(() => {
    if (!url) {
      setStatus("closed");
      return;
    }

    let socket: WebSocket | null = null;
    let reconnectTimer: ReturnType<typeof setTimeout> | null = null;
    let cancelled = false;
    let retries = 0;

    const connect = () => {
      setStatus("connecting");
      socket = new WebSocket(url);
      socketRef.current = socket;

      socket.onopen = () => {
        if (cancelled) return;
        // A successful connection clears the accumulated backoff so a later
        // outage starts over at the initial delay.
        retries = 0;
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
        setStatus("closed");
        const delay = Math.min(
          INITIAL_RECONNECT_DELAY_MS * 2 ** retries,
          MAX_RECONNECT_DELAY_MS,
        );
        retries += 1;
        reconnectTimer = setTimeout(connect, delay);
      };
    };

    connect();

    const handleVisibilityChange = () => {
      if (document.visibilityState !== "visible") return;
      const s = socketRef.current;
      if (s && s.readyState === WebSocket.CLOSED) {
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
  }, [url]);

  return { status, lastMessage };
}
