import { getFormatters } from "./format";

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

/**
 * Locale-aware relative time. Delegates to the shared formatter layer so the
 * active locale drives the output (e.g. "hace 5 minutos" / "vor 5 Minuten").
 * Falls back to the fixed English helpers when no locale is supplied.
 */
export function timeAgoLocale(
  iso: string,
  locale?: string,
  now: number = Date.now(),
): string {
  if (!locale) return timeAgo(iso, now);
  return getFormatters(locale).formatRelative(iso, now);
}

/**
 * Locale-aware remaining time. Uses the shared formatter layer for the active
 * locale and falls back to the fixed English helper when none is supplied.
 */
export function timeRemainingLocale(
  iso: string,
  locale?: string,
  now: number = Date.now(),
): string {
  if (!locale) return timeRemaining(iso, now);
  return getFormatters(locale).formatRelative(iso, now);
}
