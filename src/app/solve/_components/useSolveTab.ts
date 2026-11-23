import { useCallback, useEffect, useState } from "react";

export const SOLVE_TABS = ["leaderboard", "intents", "register"] as const;
export type SolveTab = (typeof SOLVE_TABS)[number];

function isSolveTab(value: string | null): value is SolveTab {
  return SOLVE_TABS.some((tab) => tab === value);
}

/**
 * Active tab synced to `?tab=`. Uses history.replaceState rather than the
 * Next router so switching tabs never re-renders the route or adds history
 * entries. The URL is read after mount to keep server and client markup equal.
 */
export function useSolveTab() {
  const [tab, setTabState] = useState<SolveTab>("leaderboard");

  useEffect(() => {
    const fromUrl = new URLSearchParams(window.location.search).get("tab");
    if (isSolveTab(fromUrl)) setTabState(fromUrl);
  }, []);

  const setTab = useCallback((next: SolveTab) => {
    setTabState(next);
    const url = new URL(window.location.href);
    if (next === "leaderboard") url.searchParams.delete("tab");
    else url.searchParams.set("tab", next);
    window.history.replaceState(window.history.state, "", url);
  }, []);

  return [tab, setTab] as const;
}

/**
 * WAI-ARIA tabs keyboard handler for a horizontal tablist. Left/Right move
 * between tabs (wrapping), Home/End jump to the first/last tab. Returns the
 * next tab to activate, or `null` when the key is not handled.
 */
export function getNextSolveTab(
  current: SolveTab,
  key: string,
): SolveTab | null {
  const index = SOLVE_TABS.indexOf(current);
  switch (key) {
    case "ArrowRight":
      return SOLVE_TABS[(index + 1) % SOLVE_TABS.length];
    case "ArrowLeft":
      return SOLVE_TABS[(index - 1 + SOLVE_TABS.length) % SOLVE_TABS.length];
    case "Home":
      return SOLVE_TABS[0];
    case "End":
      return SOLVE_TABS[SOLVE_TABS.length - 1];
    default:
      return null;
  }
}
