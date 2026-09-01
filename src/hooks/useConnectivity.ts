import { useCallback, useEffect, useRef, useState } from "react";
import { mutate } from "swr";

/** How long (ms) a connection loss must persist before we show the banner. */
const OFFLINE_DEBOUNCE_MS = 1500;

export type ConnectivityState = "online" | "offline";

/**
 * Tracks browser connectivity via the `online`/`offline` window events.
 *
 * Design decisions:
 * - We deliberately ignore `navigator.onLine` at mount because Safari and
 *   Firefox sometimes report an incorrect initial value. Instead we only trust
 *   the event stream, treating the first `offline` event as authoritative.
 * - We debounce the transition to "offline" by `OFFLINE_DEBOUNCE_MS` to avoid
 *   showing the banner on transient sub-second blips.
 * - On regaining connectivity we call SWR's global `mutate()` (no key) which
 *   revalidates every cached SWR entry at once, so the UI refreshes
 *   immediately instead of waiting for each hook's own retry timer.
 *
 * Returns the current connectivity state and the number of times the
 * connection has been restored (useful for testing).
 */
export function useConnectivity(): {
  connectivity: ConnectivityState;
  reconnectionCount: number;
} {
  // We start optimistically as "online" — the first `offline` event corrects
  // this if the browser truly has no network access.
  const [connectivity, setConnectivity] = useState<ConnectivityState>("online");
  const [reconnectionCount, setReconnectionCount] = useState(0);

  const offlineTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  // Track whether we've already gone offline this session so we know when a
  // subsequent `online` event constitutes a genuine reconnection.
  const wasOfflineRef = useRef(false);

  const clearOfflineTimer = useCallback(() => {
    if (offlineTimerRef.current !== null) {
      clearTimeout(offlineTimerRef.current);
      offlineTimerRef.current = null;
    }
  }, []);

  const handleOffline = useCallback(() => {
    // Debounce: only mark as offline after the blip threshold has elapsed.
    clearOfflineTimer();
    offlineTimerRef.current = setTimeout(() => {
      wasOfflineRef.current = true;
      setConnectivity("offline");
    }, OFFLINE_DEBOUNCE_MS);
  }, [clearOfflineTimer]);

  const handleOnline = useCallback(() => {
    // Cancel a pending offline debounce — connectivity was restored before the
    // timer fired, so there's nothing to show.
    clearOfflineTimer();

    if (!wasOfflineRef.current) return; // Never actually went offline; nothing to do.

    setConnectivity("online");
    setReconnectionCount((c) => c + 1);

    // Trigger a coordinated revalidation of all SWR-cached data now that
    // we're back online, instead of waiting for each hook's own retry timing.
    mutate(() => true, undefined, { revalidate: true });
  }, [clearOfflineTimer]);

  useEffect(() => {
    window.addEventListener("offline", handleOffline);
    window.addEventListener("online", handleOnline);
    return () => {
      clearOfflineTimer();
      window.removeEventListener("offline", handleOffline);
      window.removeEventListener("online", handleOnline);
    };
  }, [handleOffline, handleOnline, clearOfflineTimer]);

  return { connectivity, reconnectionCount };
}
