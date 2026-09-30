/**
 * Theme resolution and persistence helpers for the user-selectable
 * Light/Dark/System theme system (issue #493).
 *
 * The effective theme is derived from a user preference ("system" | "light" |
 * "dark") combined with the OS-level `prefers-color-scheme` signal. The
 * resolved value is written to the `data-theme` attribute on `<html>` so CSS
 * variables can switch palettes without duplicating the light palette inside
 * media queries.
 */

export type ThemePreference = "system" | "light" | "dark";
export type ResolvedTheme = "light" | "dark";

/** Storage key used by the storage facade for the persisted preference. */
export const THEME_STORAGE_KEY = "theme-preference";

/** `theme-color` meta values per resolved theme (kept in sync with globals.css). */
export const THEME_COLOR: Record<ResolvedTheme, string> = {
  light: "#ffffff",
  dark: "#0b0f19",
};

const VALID_PREFERENCES: readonly ThemePreference[] = ["system", "light", "dark"];

/**
 * Pure resolution of the effective theme. Kept free of DOM access so it can be
 * unit tested and reused by the inline SSR script.
 */
export function resolveTheme(
  preference: ThemePreference,
  systemPrefersDark: boolean,
): ResolvedTheme {
  if (preference === "light" || preference === "dark") {
    return preference;
  }
  return systemPrefersDark ? "dark" : "light";
}

/** Narrow an arbitrary stored value to a valid preference, defaulting to system. */
export function normalizePreference(value: unknown): ThemePreference {
  return typeof value === "string" &&
    (VALID_PREFERENCES as readonly string[]).includes(value)
    ? (value as ThemePreference)
    : "system";
}

/**
 * Read the persisted preference through the storage facade. Falls back to
 * "system" when storage is unavailable or blocked (e.g. private mode, CSP).
 */
export function readStoredPreference(): ThemePreference {
  if (typeof window === "undefined") {
    return "system";
  }
  try {
    return normalizePreference(window.localStorage.getItem(THEME_STORAGE_KEY));
  } catch {
    return "system";
  }
}

/**
 * Persist the preference through the storage facade. Storage failures are
 * swallowed so a blocked store never breaks the UI.
 */
export function persistPreference(preference: ThemePreference): void {
  if (typeof window === "undefined") {
    return;
  }
  try {
    window.localStorage.setItem(THEME_STORAGE_KEY, preference);
  } catch {
    /* storage blocked — preference stays in-memory for this session */
  }
}

/** Detect the current OS-level dark preference, with a legacy Safari fallback. */
export function systemPrefersDark(): boolean {
  if (typeof window === "undefined" || typeof window.matchMedia !== "function") {
    return false;
  }
  return window.matchMedia("(prefers-color-scheme: dark)").matches;
}

/**
 * Apply a resolved theme to the document: `data-theme` drives the CSS
 * variables and `color-scheme` keeps native controls in sync.
 */
export function applyResolvedTheme(theme: ResolvedTheme): void {
  if (typeof document === "undefined") {
    return;
  }
  const root = document.documentElement;
  root.setAttribute("data-theme", theme);
  root.style.colorScheme = theme;
  updateThemeColorMeta(theme);
}

/** Keep `<meta name="theme-color">` aligned with the effective theme. */
export function updateThemeColorMeta(theme: ResolvedTheme): void {
  if (typeof document === "undefined") {
    return;
  }
  let meta = document.querySelector<HTMLMetaElement>('meta[name="theme-color"]');
  if (!meta) {
    meta = document.createElement("meta");
    meta.name = "theme-color";
    document.head.appendChild(meta);
  }
  meta.content = THEME_COLOR[theme];
}

/**
 * Subscribe to OS theme changes. Returns an unsubscribe function. Uses the
 * legacy `addListener`/`removeListener` API on Safari < 16.
 */
export function subscribeToSystemTheme(
  onChange: (prefersDark: boolean) => void,
): () => void {
  if (typeof window === "undefined" || typeof window.matchMedia !== "function") {
    return () => {};
  }
  const query = window.matchMedia("(prefers-color-scheme: dark)");
  const handler = (event: MediaQueryListEvent | MediaQueryList) => {
    onChange(event.matches);
  };

  if (typeof query.addEventListener === "function") {
    query.addEventListener("change", handler);
    return () => query.removeEventListener("change", handler);
  }

  // Safari < 16 fallback.
  query.addListener(handler);
  return () => query.removeListener(handler);
}

/**
 * Serialized inline script injected before paint to set `data-theme` and avoid
 * a flash of the wrong theme. CSP-nonce compatible: the caller passes the nonce
 * and the script only reads storage / matchMedia, never eval.
 */
export function getThemeInitScript(nonce?: string): string {
  const nonceAttr = nonce ? ` nonce="${nonce}"` : "";
  return `<script${nonceAttr}>${THEME_INIT_SOURCE}</script>`;
}

/**
 * The blocking bootstrap body. Kept as a string so it can be inlined into the
 * server-rendered `<head>` and executed before first paint.
 */
export const THEME_INIT_SOURCE = `(function(){try{var p=localStorage.getItem(${JSON.stringify(
  THEME_STORAGE_KEY,
)});if(p!=="light"&&p!=="dark"){p="system";}var d=p==="dark"||(p==="system"&&window.matchMedia&&window.matchMedia("(prefers-color-scheme: dark)").matches);var t=d?"dark":"light";var r=document.documentElement;r.setAttribute("data-theme",t);r.style.colorScheme=t;var m=document.querySelector('meta[name="theme-color"]');if(!m){m=document.createElement("meta");m.name="theme-color";document.head.appendChild(m);}m.content=d?${JSON.stringify(
  THEME_COLOR.dark,
)}:${JSON.stringify(THEME_COLOR.light)};}catch(e){document.documentElement.setAttribute("data-theme","light");}})();`;
