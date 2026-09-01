import { useEffect, useState } from "react";

// Default cadence for refreshing relative timestamps. 45s keeps "2m ago" style
// labels honest without the re-render churn of a per-second tick.
export const DEFAULT_RELATIVE_TIME_INTERVAL_MS = 45_000;

/**
 * Returns a `now` timestamp that advances on an interval, so components rendering
 * relative times (`timeAgo(iso, now)`) stay current without an unrelated
 * re-render. Call this once per long-lived list view and share the value across
 * rows - a single interval, not one timer per row.
 *
 * The interval pauses while the tab is backgrounded (same `visibilitychange`
 * pattern as `useWebSocket`) and is cleared on unmount.
 */
export function useLiveRelativeTime(
  intervalMs: number = DEFAULT_RELATIVE_TIME_INTERVAL_MS,
): number {
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    let timer: ReturnType<typeof setInterval> | null = null;

    const start = () => {
      if (timer === null) {
        timer = setInterval(() => setNow(Date.now()), intervalMs);
      }
    };
    const stop = () => {
      if (timer !== null) {
        clearInterval(timer);
        timer = null;
      }
    };

    const handleVisibilityChange = () => {
      if (document.visibilityState === "visible") {
        // Catch up immediately on return, then resume ticking.
        setNow(Date.now());
        start();
      } else {
        stop();
      }
    };

    if (document.visibilityState === "visible") start();
    document.addEventListener("visibilitychange", handleVisibilityChange);

    return () => {
      stop();
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, [intervalMs]);

  return now;
}
