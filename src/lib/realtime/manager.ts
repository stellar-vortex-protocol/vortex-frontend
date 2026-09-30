import {
  WebSocketClient,
  type ConnectionState,
  type WebSocketClientOptions,
} from "./webSocketClient";
import { secureLogger } from "@/lib/secureLogging";

/**
 * Module-singleton realtime manager: one WebSocketClient per URL, shared by
 * every subscriber and reference counted. The socket opens on the first
 * subscriber and closes `LINGER_MS` after the last one leaves, so route
 * changes that unmount/remount subscribers don't thrash the connection.
 *
 * Frames carrying a string `topic` field are routed to that topic; frames
 * without one go to `DEFAULT_TOPIC` (the relay's intents feed today).
 */

export const DEFAULT_TOPIC = "intents";
export const LINGER_MS = 2000;

/** Opt-in: send `{type:"subscribe"|"unsubscribe", topic}` frames to the relay. */
const SEND_SUBSCRIBE_FRAMES = process.env["NEXT_PUBLIC_WS_SUBSCRIBE_FRAMES"] === "true";

export type Handler<T> = (message: T) => void;
export type Filter<T> = (message: T) => boolean;

interface Subscriber {
  topic: string;
  handler: Handler<unknown>;
  filter?: Filter<unknown>;
}

interface Connection {
  client: WebSocketClient;
  subscribers: Set<Subscriber>;
  statusListeners: Set<(s: ConnectionState) => void>;
  lingerTimer: ReturnType<typeof setTimeout> | null;
  detach: () => void;
}

const connections = new Map<string, Connection>();
let clientOptions: WebSocketClientOptions = {};

/** Test hook: inject WebSocket/timer implementations for new connections. */
export function configureRealtime(options: WebSocketClientOptions): void {
  clientOptions = options;
}

function topicCount(conn: Connection, topic: string): number {
  let n = 0;
  conn.subscribers.forEach((s) => {
    if (s.topic === topic) n += 1;
  });
  return n;
}

function attachEnvironment(client: WebSocketClient): () => void {
  if (typeof window === "undefined") return () => {};
  const onOffline = () => client.pause();
  const onOnline = () => client.resume();
  const onVisible = () => {
    if (document.visibilityState !== "visible") return;
    const state = client.getState();
    if (state === "unavailable" || state === "backoff") client.reconnect();
  };
  window.addEventListener("offline", onOffline);
  window.addEventListener("online", onOnline);
  document.addEventListener("visibilitychange", onVisible);
  return () => {
    window.removeEventListener("offline", onOffline);
    window.removeEventListener("online", onOnline);
    document.removeEventListener("visibilitychange", onVisible);
  };
}

function getConnection(url: string): Connection {
  const existing = connections.get(url);
  if (existing) {
    if (existing.lingerTimer) {
      clearTimeout(existing.lingerTimer);
      existing.lingerTimer = null;
    }
    return existing;
  }

  const client = new WebSocketClient(url, clientOptions);
  const conn: Connection = {
    client,
    subscribers: new Set(),
    statusListeners: new Set(),
    lingerTimer: null,
    detach: () => {},
  };

  client.onMessage((raw) => {
    const topic =
      raw && typeof raw === "object" && typeof (raw as { topic?: unknown }).topic === "string"
        ? (raw as { topic: string }).topic
        : DEFAULT_TOPIC;
    // Snapshot so handlers that unsubscribe mid-dispatch don't skip others.
    [...conn.subscribers].forEach((sub) => {
      if (sub.topic !== topic) return;
      try {
        if (sub.filter && !sub.filter(raw)) return;
        sub.handler(raw);
      } catch (error) {
        // One failing subscriber must never break fan-out to the rest.
        secureLogger.error("realtime subscriber threw", { topic, error: String(error) });
      }
    });
  });
  client.onState((state) => {
    conn.statusListeners.forEach((l) => l(state));
    if (state === "open" && SEND_SUBSCRIBE_FRAMES) {
      new Set([...conn.subscribers].map((s) => s.topic)).forEach((topic) =>
        client.send({ type: "subscribe", topic }),
      );
    }
  });

  conn.detach = attachEnvironment(client);
  connections.set(url, conn);
  client.connect();
  return conn;
}

function release(url: string, conn: Connection): void {
  if (conn.subscribers.size > 0 || conn.statusListeners.size > 0) return;
  if (conn.lingerTimer) return;
  conn.lingerTimer = setTimeout(() => {
    conn.lingerTimer = null;
    if (conn.subscribers.size > 0 || conn.statusListeners.size > 0) return;
    conn.detach();
    conn.client.close();
    connections.delete(url);
  }, LINGER_MS);
}

/** Subscribe to a topic on `url`. Returns an unsubscribe handle. SSR-safe. */
export function subscribe<T>(
  url: string,
  topic: string,
  handler: Handler<T>,
  filter?: Filter<T>,
): () => void {
  if (typeof window === "undefined") return () => {};
  const conn = getConnection(url);
  const sub: Subscriber = {
    topic,
    handler: handler as Handler<unknown>,
    filter: filter as Filter<unknown> | undefined,
  };
  conn.subscribers.add(sub);
  if (SEND_SUBSCRIBE_FRAMES && topicCount(conn, topic) === 1) {
    conn.client.send({ type: "subscribe", topic });
  }
  return () => {
    if (!conn.subscribers.delete(sub)) return;
    if (SEND_SUBSCRIBE_FRAMES && topicCount(conn, topic) === 0) {
      conn.client.send({ type: "unsubscribe", topic });
    }
    release(url, conn);
  };
}

/** Observe connection state for `url`; the listener fires immediately. */
export function watchStatus(url: string, listener: (s: ConnectionState) => void): () => void {
  if (typeof window === "undefined") return () => {};
  const conn = getConnection(url);
  conn.statusListeners.add(listener);
  listener(conn.client.getState());
  return () => {
    if (!conn.statusListeners.delete(listener)) return;
    release(url, conn);
  };
}

/** Manual retry, e.g. from an `unavailable` indicator. */
export function reconnect(url: string): void {
  connections.get(url)?.client.reconnect();
}

export interface RealtimeDebugInfo {
  url: string;
  state: ConnectionState;
  subscribers: Record<string, number>;
}

export function getRealtimeDebugInfo(): RealtimeDebugInfo[] {
  return [...connections.entries()].map(([url, conn]) => {
    const subscribers: Record<string, number> = {};
    conn.subscribers.forEach((s) => {
      subscribers[s.topic] = (subscribers[s.topic] ?? 0) + 1;
    });
    return { url, state: conn.client.getState(), subscribers };
  });
}

/** Test/hot-reload helper: close every connection immediately. */
export function resetRealtime(): void {
  connections.forEach((conn) => {
    if (conn.lingerTimer) clearTimeout(conn.lingerTimer);
    conn.detach();
    conn.client.close();
  });
  connections.clear();
}
