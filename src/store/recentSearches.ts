import { create } from "zustand";
import { createSyncedPersist } from "@/lib/persist";
import { MAX_QUERY_LENGTH, readQuery } from "@/lib/searchQuery";

export const RECENT_SEARCHES_KEY = "vortex-recent-searches";
export const MAX_RECENT_SEARCHES = 8;

type PersistedRecentSearches = { recent: string[] };

type RecentSearchesState = PersistedRecentSearches & {
  addRecent: (query: string) => void;
  clearRecent: () => void;
};

function isPersistedRecent(value: unknown): value is PersistedRecentSearches {
  if (typeof value !== "object" || value === null) return false;
  const recent = (value as Record<string, unknown>)["recent"];
  return (
    Array.isArray(recent) &&
    recent.length <= MAX_RECENT_SEARCHES &&
    recent.every((q) => typeof q === "string" && q.length <= MAX_QUERY_LENGTH)
  );
}

export const useRecentSearchesStore = create<RecentSearchesState>()(
  createSyncedPersist(
    (set, get) => ({
      recent: [],
      addRecent: (query) => {
        const clean = readQuery(query).trim();
        if (!clean) return;
        const rest = get().recent.filter((q) => q !== clean);
        set({ recent: [clean, ...rest].slice(0, MAX_RECENT_SEARCHES) });
      },
      clearRecent: () => set({ recent: [] }),
    }),
    {
      name: RECENT_SEARCHES_KEY,
      version: 0,
      partialize: (state) => ({ recent: state.recent }),
      validate: isPersistedRecent,
    },
  ),
);
