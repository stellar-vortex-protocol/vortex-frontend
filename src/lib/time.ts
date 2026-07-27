function getDefaultLocale(): string {
  if (typeof navigator !== "undefined" && navigator.language) {
    return navigator.language;
  }

  return "en";
}

function shouldPreserveEnglishOutput(locale?: string | string[]): boolean {
  if (!locale) return true;

  const normalizedLocale = Array.isArray(locale) ? locale[0] : locale;
  if (!normalizedLocale) return true;

  return /^en(?:[-_].+)?$/i.test(normalizedLocale);
}

function formatRelativeTime(value: number, unit: Intl.RelativeTimeFormatUnit, locale?: string | string[]): string {
  return new Intl.RelativeTimeFormat(locale ?? getDefaultLocale(), { numeric: "always" }).format(value, unit);
}

export function timeAgo(iso: string, now: number = Date.now(), locale?: string | string[]): string {
  const diffSeconds = Math.max(0, Math.floor((now - new Date(iso).getTime()) / 1000));

  if (diffSeconds < 5) return "just now";
  if (diffSeconds < 60) {
    return shouldPreserveEnglishOutput(locale) ? `${diffSeconds}s ago` : formatRelativeTime(-diffSeconds, "second", locale);
  }

  const diffMinutes = Math.floor(diffSeconds / 60);
  if (diffMinutes < 60) {
    return shouldPreserveEnglishOutput(locale) ? `${diffMinutes}m ago` : formatRelativeTime(-diffMinutes, "minute", locale);
  }

  const diffHours = Math.floor(diffMinutes / 60);
  if (diffHours < 24) {
    return shouldPreserveEnglishOutput(locale) ? `${diffHours}h ago` : formatRelativeTime(-diffHours, "hour", locale);
  }

  const diffDays = Math.floor(diffHours / 24);
  return shouldPreserveEnglishOutput(locale) ? `${diffDays}d ago` : formatRelativeTime(-diffDays, "day", locale);
}

export function timeRemaining(iso: string, now: number = Date.now(), locale?: string | string[]): string {
  const diffSeconds = Math.floor((new Date(iso).getTime() - now) / 1000);
  if (diffSeconds <= 0) return "Expired";
  if (diffSeconds < 60) {
    return shouldPreserveEnglishOutput(locale) ? `${diffSeconds}s` : formatRelativeTime(diffSeconds, "second", locale);
  }

  const diffMinutes = Math.floor(diffSeconds / 60);
  if (diffMinutes < 60) {
    return shouldPreserveEnglishOutput(locale) ? `${diffMinutes}m` : formatRelativeTime(diffMinutes, "minute", locale);
  }

  const diffHours = Math.floor(diffMinutes / 60);
  return shouldPreserveEnglishOutput(locale) ? `${diffHours}h` : formatRelativeTime(diffHours, "hour", locale);
}
