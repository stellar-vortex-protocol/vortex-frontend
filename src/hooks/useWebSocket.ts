import { useEffect, useRef, useState } from "react";

export type WebSocketStatus = "connecting" | "open" | "closed" | "error";

const RECONNECT_DELAY_MS = 3000;

// Generic JSON-over-WebSocket subscription with auto-reconnect. Passing a
// null url tears down any existing connection and stays idle — useful for
// gating the connection behind a feature flag or missing config.
export function useWebSocket<T>(url: string | null) {
  const [status, setStatus] = useState<WebSocketStatus>("connecting");
  const [lastMessage, setLastMessage] = useState<T | null>(null);

  useEffect(() => {
    if (!url) {
      setStatus("closed");
      return;
    }

    let socket: WebSocket | null = null;
    let reconnectTimer: ReturnType<typeof setTimeout> | null = null;
    let cancelled = false;

    const connect = () => {
      setStatus("connecting");
      socket = new WebSocket(url);

      socket.onopen = () => {
        if (!cancelled) setStatus("open");
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
        reconnectTimer = setTimeout(connect, RECONNECT_DELAY_MS);
      };
    };

    connect();

    return () => {
      cancelled = true;
      if (reconnectTimer) clearTimeout(reconnectTimer);
      socket?.close();
    };
  }, [url]);

  return { status, lastMessage };
}
