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
