import { useCallback, useEffect, useRef, useState } from "react";
import {
  reconnect as reconnectUrl,
  subscribe,
  watchStatus,
  type Filter,
} from "@/lib/realtime/manager";
import type { ConnectionState } from "@/lib/realtime/webSocketClient";

/**
 * Subscribe to `topic` on the shared connection for `url`. The handler and
 * filter are read through refs, so the subscription only changes with
 * `url`/`topic` — never on re-render. Passing a null url subscribes to nothing.
 */
export function useRealtimeTopic<T>(
  url: string | null,
  topic: string,
  handler: (message: T) => void,
  filter?: Filter<T>,
): void {
  const handlerRef = useRef(handler);
  const filterRef = useRef(filter);
  handlerRef.current = handler;
  filterRef.current = filter;

  useEffect(() => {
    if (!url) return;
    return subscribe<T>(
      url,
      topic,
      (m) => handlerRef.current(m),
      (m) => (filterRef.current ? filterRef.current(m) : true),
    );
  }, [url, topic]);
}

/** Connection state for `url` ("closed" when url is null) plus manual retry. */
export function useRealtimeStatus(url: string | null): {
  status: ConnectionState;
  reconnect: () => void;
} {
  const [status, setStatus] = useState<ConnectionState>(url ? "connecting" : "closed");

  useEffect(() => {
    if (!url) {
      setStatus("closed");
      return;
    }
    let active = true;
    const stop = watchStatus(url, (s) => {
      if (active) setStatus(s);
    });
    return () => {
      active = false;
      stop();
    };
  }, [url]);

  const reconnect = useCallback(() => {
    if (url) reconnectUrl(url);
  }, [url]);

  return { status, reconnect };
}
