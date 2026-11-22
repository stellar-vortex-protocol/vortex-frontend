"use client";

import { useEffect, useState } from "react";

import { timeRemaining } from "@/lib/time";

/**
 * Inline time-to-deadline label; turns amber in the final five minutes and
 * flips to the expired state on its own once the deadline elapses.
 *
 * A single timeout is scheduled for the deadline (no interval), so the chip
 * re-renders exactly once when it expires; the timeout is cleared on unmount.
 */
export function DeadlineChip({ deadline, now }: { deadline: string; now?: number }) {
  const deadlineMs = new Date(deadline).getTime();
  const [current, setCurrent] = useState(() => now ?? Date.now());

  useEffect(() => {
    if (now !== undefined) {
      setCurrent(now);
      return;
    }
    const remaining = deadlineMs - Date.now();
    if (!Number.isFinite(remaining) || remaining <= 0) return;
    const timer = setTimeout(() => setCurrent(Date.now()), remaining);
    return () => clearTimeout(timer);
  }, [deadlineMs, now]);

  const expired = current >= deadlineMs;
  const urgent = !expired && deadlineMs - current < 5 * 60_000;
  const className = expired ? "text-vx-rose" : urgent ? "text-vx-amber" : undefined;

  return (
    <time
      dateTime={deadline}
      title={new Date(deadline).toLocaleString()}
      className={className}
      data-expired={expired ? "true" : undefined}
    >
      {timeRemaining(deadline, current)}
    </time>
  );
}
