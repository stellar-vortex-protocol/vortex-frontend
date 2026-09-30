import { useState } from "react";
import { DEFAULT_TOPIC } from "@/lib/realtime/manager";
import type { ConnectionState } from "@/lib/realtime/webSocketClient";
import { useRealtimeStatus, useRealtimeTopic } from "./useRealtime";

export type WebSocketStatus = ConnectionState;

/**
 * Thin JSON-over-WebSocket hook on top of the shared realtime manager.
 * Connection lifecycle (backoff, heartbeat, offline/visibility handling)
 * lives in `WebSocketClient`; every caller with the same URL shares one
 * socket. Its only effect dependency is the URL, so status transitions
 * never tear down the connection. Passing a null url stays idle.
 */
export function useWebSocket<T>(url: string | null) {
  const [lastMessage, setLastMessage] = useState<T | null>(null);
  const { status, reconnect } = useRealtimeStatus(url);
  useRealtimeTopic<T>(url, DEFAULT_TOPIC, (m) => setLastMessage(() => m));
  return { status, lastMessage, reconnect };
}
}
