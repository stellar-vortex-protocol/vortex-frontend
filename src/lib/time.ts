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

const MS_PER_HOUR = 60 * 60 * 1000;
const MS_PER_DAY = 24 * MS_PER_HOUR;

/**
 * Timezone policy: all bucketing is performed in UTC. Local time is only ever
 * applied at the presentation layer (axis labels) via `formatBucketLabel`.
 */
export type Granularity = "hour" | "day" | "week";

/** Truncate a timestamp to the start of its UTC hour. */
export function startOfUtcHour(ms: number): number {
  return Math.floor(ms / MS_PER_HOUR) * MS_PER_HOUR;
}

/** Truncate a timestamp to the start of its UTC day (00:00:00.000Z). */
export function startOfUtcDay(ms: number): number {
  return Math.floor(ms / MS_PER_DAY) * MS_PER_DAY;
}

/**
 * Truncate a timestamp to the start of its ISO week (Monday 00:00:00.000Z).
 * Correct across year boundaries because it is derived from the UTC epoch day.
 */
export function startOfUtcWeek(ms: number): number {
  const dayStart = startOfUtcDay(ms);
  // 1970-01-01 was a Thursday; shift so Monday is day 0.
  const dayOfWeek = (((Math.floor(dayStart / MS_PER_DAY) + 3) % 7) + 7) % 7;
  return dayStart - dayOfWeek * MS_PER_DAY;
}

/** Truncate a timestamp to the start of the requested UTC bucket. */
export function startOfUtcBucket(ms: number, granularity: Granularity): number {
  switch (granularity) {
    case "hour":
      return startOfUtcHour(ms);
    case "week":
      return startOfUtcWeek(ms);
    case "day":
    default:
      return startOfUtcDay(ms);
  }
}

/** Advance a bucket start by one unit of the given granularity (UTC). */
export function addUtcBucket(ms: number, granularity: Granularity): number {
  switch (granularity) {
    case "hour":
      return ms + MS_PER_HOUR;
    case "week":
      return ms + 7 * MS_PER_DAY;
    case "day":
    default:
      return ms + MS_PER_DAY;
  }
}

/**
 * Format a UTC bucket start for display. When `local` is true the label is
 * rendered in the viewer's local timezone; bucketing itself stays UTC.
 */
export function formatBucketLabel(
  ms: number,
  granularity: Granularity,
  local = false,
): string {
  const date = new Date(ms);
  const options: Intl.DateTimeFormatOptions =
    granularity === "hour"
      ? { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" }
      : { year: "numeric", month: "short", day: "numeric" };
  return new Intl.DateTimeFormat(local ? undefined : "en-US", {
    ...options,
    timeZone: local ? undefined : "UTC",
  }).format(date);
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
}
