import { useCallback, useEffect, useRef, useState } from "react";

/** Default cooldown applied after a failed wallet/submission attempt (#249). */
export const FAILURE_COOLDOWN_MS = 3000;

/**
 * useCooldown
 *
 * In-memory cooldown timer used to throttle rapid sequential retries of
 * actions that trigger a wallet popup or a backend submission. `start()` opens
 * the cooldown window; `isCoolingDown()` is a synchronous check (safe to call
 * inside the action itself, before React re-renders). `remainingSeconds` is a
 * render-friendly countdown for disabled buttons. Nothing is persisted, so a
 * page reload always clears it.
 */
export function useCooldown(ms: number = FAILURE_COOLDOWN_MS) {
  const untilRef = useRef(0);
  const [remainingMs, setRemainingMs] = useState(0);

  useEffect(() => {
    if (remainingMs <= 0) return;
    const id = setTimeout(() => {
      setRemainingMs(Math.max(0, untilRef.current - Date.now()));
    }, Math.min(remainingMs, 1000));
    return () => clearTimeout(id);
  }, [remainingMs]);

  const start = useCallback(() => {
    untilRef.current = Date.now() + ms;
    setRemainingMs(ms);
  }, [ms]);

  const reset = useCallback(() => {
    untilRef.current = 0;
    setRemainingMs(0);
  }, []);

  const isCoolingDown = useCallback(() => Date.now() < untilRef.current, []);

  return {
    start,
    reset,
    isCoolingDown,
    remainingSeconds: Math.ceil(remainingMs / 1000),
  };
}
