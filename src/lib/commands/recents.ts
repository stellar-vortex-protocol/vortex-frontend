export const RECENT_INTENTS_KEY = "vortex-recent-intents";
export const MAX_RECENT_INTENTS = 10;

export function readRecentIntents(): string[] {
  try {
    const raw = window.localStorage.getItem(RECENT_INTENTS_KEY);
    const parsed: unknown = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed.filter((v): v is string => typeof v === "string") : [];
  } catch {
    return [];
  }
}

/** Records an intent view locally (most recent first, de-duplicated, capped). */
export function pushRecentIntent(id: string): void {
  try {
    const next = [id, ...readRecentIntents().filter((v) => v !== id)].slice(0, MAX_RECENT_INTENTS);
    window.localStorage.setItem(RECENT_INTENTS_KEY, JSON.stringify(next));
  } catch {
    // Storage unavailable (private mode) — recents are a convenience only.
  }
}
