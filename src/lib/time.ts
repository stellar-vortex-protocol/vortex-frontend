export function timeAgo(iso: string, now: number = Date.now()): string {
  const diffSeconds = Math.max(
    0,
    Math.floor((now - new Date(iso).getTime()) / 1000),
  );

  if (diffSeconds < 5) return "just now";
  if (diffSeconds < 60) return `${diffSeconds}s ago`;

  const diffMinutes = Math.floor(diffSeconds / 60);
  if (diffMinutes < 60) return `${diffMinutes}m ago`;

  const diffHours = Math.floor(diffMinutes / 60);
  if (diffHours < 24) return `${diffHours}h ago`;

  const diffDays = Math.floor(diffHours / 24);
  return `${diffDays}d ago`;
}

export function timeRemaining(iso: string, now: number = Date.now()): string {
  const diffSeconds = Math.floor((new Date(iso).getTime() - now) / 1000);
  if (diffSeconds <= 0) return "Expired";
  if (diffSeconds < 60) return `${diffSeconds}s`;

  const diffMinutes = Math.floor(diffSeconds / 60);
  if (diffMinutes < 60) return `${diffMinutes}m`;

  const diffHours = Math.floor(diffMinutes / 60);
  return `${diffHours}h`;
}

/** Seconds under which a deadline countdown is considered urgent. */
export const URGENT_THRESHOLD_SECONDS = 60;

/**
 * Precise countdown for deadline-driven UIs (e.g. the solver open-intents
 * board). Returns "m:ss" under an hour, "Hh Mm" above, and "0:00" once expired.
 * `now` should already include any server clock offset.
 */
export function formatTimeRemaining(iso: string, now: number = Date.now()): string {
  const total = Math.floor((new Date(iso).getTime() - now) / 1000);
  if (!Number.isFinite(total) || total <= 0) return "0:00";
  if (total < 3600) {
    const m = Math.floor(total / 60);
    const s = total % 60;
    return `${m}:${String(s).padStart(2, "0")}`;
  }
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  return `${h}h ${m}m`;
}

/** Whole seconds left until `iso` (negative once passed). */
export function secondsRemaining(iso: string, now: number = Date.now()): number {
  return Math.floor((new Date(iso).getTime() - now) / 1000);
}
