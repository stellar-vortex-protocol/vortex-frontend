import type { FeedItem, IntentStatus } from "@/lib/types";

// Status lifecycle rank. A transition to a lower rank is a regression
// (e.g. `filled → pending` from a stale REST snapshot) and is rejected.
// `filled` and `failed` are both terminal.
export const STATUS_RANK: Record<IntentStatus, number> = {
  pending: 0,
  accepted: 1,
  filled: 2,
  failed: 2,
};

function versionOf(item: FeedItem): number | null {
  if (typeof item.version === "number") return item.version;
  if (item.updatedAt) {
    const t = Date.parse(item.updatedAt);
    if (!Number.isNaN(t)) return t;
  }
  return null;
}

/**
 * Merge an incoming record for the same intent id into the current one.
 * Latest write wins by `version` (or `updatedAt`), fields are merged so a
 * richer payload (e.g. IntentDetail) is never overwritten by a leaner one
 * (FeedItem), and status regressions are always rejected regardless of
 * version — the clock-skew-safe invariant.
 */
export function reconcile<T extends FeedItem>(current: T | undefined, incoming: T): T {
  if (!current) return incoming;

  const cv = versionOf(current);
  const iv = versionOf(incoming);
  if (cv !== null && iv !== null && iv < cv) return current;

  const merged = { ...current, ...incoming };
  if (STATUS_RANK[incoming.status] < STATUS_RANK[current.status]) {
    merged.status = current.status;
  }
  if (STATUS_RANK[current.status] === 2 && STATUS_RANK[incoming.status] === 2) {
    // Terminal states never flip between `filled` and `failed`.
    merged.status = current.status;
  }
  return merged;
}
