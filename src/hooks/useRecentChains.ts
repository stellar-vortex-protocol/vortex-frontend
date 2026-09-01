/**
 * useRecentChains
 *
 * Tracks the last MAX_RECENT distinct chains the user has selected in the
 * SwapCard chain picker. Backed by localStorage so the list survives page
 * reloads. Automatically filters out chain IDs that no longer exist in
 * the canonical CHAINS list (e.g. a chain was removed after an app update).
 *
 * Usage:
 *   const { recentChains, addRecentChain } = useRecentChains();
 *
 *   // On chain select:
 *   addRecentChain(chainId);
 *
 *   // In the picker UI, render recentChains only when length > 0.
 */

import { useCallback, useState } from "react";
import { CHAINS } from "@/lib/marketData";

export const RECENT_CHAINS_KEY = "vortex:recentChains";
export const MAX_RECENT = 3;

/** Returns the valid (still-in-CHAINS), deduped, capped recent chain IDs. */
function readFromStorage(): string[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(RECENT_CHAINS_KEY);
    if (!raw) return [];
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    const validIds = new Set(CHAINS.map(c => c.id));
    // Filter out any IDs that are no longer in CHAINS, preserve order.
    return (parsed as unknown[])
      .filter((item): item is string => typeof item === "string" && validIds.has(item))
      .slice(0, MAX_RECENT);
  } catch {
    return [];
  }
}

function writeToStorage(ids: string[]): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(RECENT_CHAINS_KEY, JSON.stringify(ids));
  } catch {
    // localStorage may be unavailable (private browsing, quota, etc.) — fail silently.
  }
}

/**
 * Prepends `id` to the list, deduplicates, and caps at MAX_RECENT.
 * Returns the new array without mutating the input.
 */
export function buildRecentList(current: string[], id: string): string[] {
  const deduped = [id, ...current.filter(c => c !== id)];
  return deduped.slice(0, MAX_RECENT);
}

export function useRecentChains() {
  const [recentIds, setRecentIds] = useState<string[]>(() => readFromStorage());

  // Resolve the full chain objects, filtering out any that no longer exist.
  const validIds = new Set(CHAINS.map(c => c.id));
  const recentChains = recentIds
    .filter(id => validIds.has(id))
    .map(id => CHAINS.find(c => c.id === id)!)
    .filter(Boolean);

  const addRecentChain = useCallback((chainId: string) => {
    setRecentIds(prev => {
      const next = buildRecentList(prev, chainId);
      writeToStorage(next);
      return next;
    });
  }, []);

  return { recentChains, addRecentChain };
}
