import { create } from "zustand";
import { reconcile } from "@/lib/realtime/reconcile";
import type { FeedItem, IntentDetail } from "@/lib/types";

export type IntentSource = "rest" | "ws" | "optimistic";
export type IntentView = "feed" | "explore" | "mine";

export type StoredIntent = FeedItem &
  Partial<Omit<IntentDetail, keyof FeedItem>> & {
    /** Client-side placeholder not yet confirmed by the relay. */
    optimistic?: boolean;
    /** Optimistic entry with no authoritative record after the timeout. */
    unconfirmed?: boolean;
  };

type Meta = { receivedAt: number };

export const INTENT_STORE_CAP = 1000;

type IntentStoreState = {
  byId: Record<string, StoredIntent>;
  meta: Record<string, Meta>;
  /** Ordered ids per view, newest first. */
  views: Record<IntentView, string[]>;
  ingest: (items: StoredIntent[], source: IntentSource, view?: IntentView) => void;
  markUnconfirmed: (id: string) => void;
  remove: (id: string) => void;
  clearOptimistic: () => void;
};

function union(ids: string[], incoming: string[], prependNew: boolean): string[] {
  const set = new Set(ids);
  const fresh = incoming.filter((id) => !set.has(id));
  return prependNew ? [...fresh, ...ids] : [...ids, ...fresh];
}

function orderByCreated(ids: string[], byId: Record<string, StoredIntent>): string[] {
  // Stable sort: ties keep insertion order, so live frames stay on top.
  const time = (id: string) => Date.parse(byId[id]?.createdAt ?? "") || 0;
  return [...ids].sort((a, b) => time(b) - time(a));
}

/**
 * Normalized intent entity store. REST snapshots, WebSocket frames and
 * optimistic submissions all flow through `ingest`, which merges per id via
 * `reconcile` (monotonic status, latest version wins). Eviction is LRU by
 * `receivedAt` once the store exceeds `INTENT_STORE_CAP` entries.
 */
export const useIntentStore = create<IntentStoreState>((set) => ({
  byId: {},
  meta: {},
  views: { feed: [], explore: [], mine: [] },

  ingest: (items, source, view) =>
    set((state) => {
      if (items.length === 0) return state;
      const now = Date.now();
      const byId = { ...state.byId };
      const meta = { ...state.meta };
      for (const item of items) {
        const current = byId[item.id];
        const next = reconcile(current, item);
        if (source !== "optimistic") {
          // An authoritative record replaces the optimistic one in place.
          delete next.optimistic;
          delete next.unconfirmed;
        }
        if (next !== current) byId[item.id] = next;
        meta[item.id] = { receivedAt: now };
      }

      // Views are the union of known ids ordered newest first, so a backfill
      // never clears existing rows and a confirmed optimistic entry keeps its
      // position.
      const ids = items.map((i) => i.id);
      const targets: IntentView[] = view ? [view] : ["feed", "explore", "mine"];
      const views = { ...state.views };
      for (const v of targets) views[v] = orderByCreated(union(state.views[v], ids, source !== "rest"), byId);

      const keys = Object.keys(byId);
      if (keys.length > INTENT_STORE_CAP) {
        const evict = keys
          .sort((a, b) => meta[a]!.receivedAt - meta[b]!.receivedAt)
          .slice(0, keys.length - INTENT_STORE_CAP);
        for (const id of evict) {
          delete byId[id];
          delete meta[id];
        }
        const alive = (id: string) => id in byId;
        views.feed = views.feed.filter(alive);
        views.explore = views.explore.filter(alive);
        views.mine = views.mine.filter(alive);
      }

      return { byId, meta, views };
    }),

  markUnconfirmed: (id) =>
    set((state) => {
      const item = state.byId[id];
      if (!item?.optimistic) return state;
      return { byId: { ...state.byId, [id]: { ...item, unconfirmed: true } } };
    }),

  remove: (id) =>
    set((state) => {
      if (!(id in state.byId)) return state;
      const byId = { ...state.byId };
      const meta = { ...state.meta };
      delete byId[id];
      delete meta[id];
      const without = (ids: string[]) => ids.filter((x) => x !== id);
      return {
        byId,
        meta,
        views: {
          feed: without(state.views.feed),
          explore: without(state.views.explore),
          mine: without(state.views.mine),
        },
      };
    }),

  clearOptimistic: () =>
    set((state) => {
      const byId = { ...state.byId };
      for (const [id, item] of Object.entries(byId)) {
        if (item.optimistic) delete byId[id];
      }
      const alive = (id: string) => id in byId;
      return {
        byId,
        views: {
          feed: state.views.feed.filter(alive),
          explore: state.views.explore.filter(alive),
          mine: state.views.mine.filter(alive),
        },
      };
    }),
}));

// ── Selectors ───────────────────────────────────────────────────────────────
// Each selector memoises on the (views, byId) references so components only
// re-render when the store actually changes.

function memoView(view: IntentView, limit: number) {
  let lastIds: string[] | null = null;
  let lastById: Record<string, StoredIntent> | null = null;
  let lastResult: StoredIntent[] = [];
  return (state: IntentStoreState): StoredIntent[] => {
    const ids = state.views[view];
    if (ids === lastIds && state.byId === lastById) return lastResult;
    const next = ids
      .slice(0, limit)
      .map((id) => state.byId[id])
      .filter((i): i is StoredIntent => i !== undefined);
    const same =
      next.length === lastResult.length && next.every((item, i) => item === lastResult[i]);
    lastIds = ids;
    lastById = state.byId;
    if (!same) lastResult = next;
    return lastResult;
  };
}

const selectorCache = new Map<string, (s: IntentStoreState) => StoredIntent[]>();

function cached(view: IntentView, limit: number) {
  const key = `${view}:${limit}`;
  let sel = selectorCache.get(key);
  if (!sel) {
    sel = memoView(view, limit);
    selectorCache.set(key, sel);
  }
  return sel;
}

export const selectFeed = (limit: number) => cached("feed", limit);
export const selectExplore = (limit: number) => cached("explore", limit);
// FeedItem does not yet expose an owner address, so "mine" is the view
// populated by the address-scoped hook; the address keys the selector so a
// wallet change never reuses another account's memoised list.
export const selectMine = (address: string | null, limit = 200) =>
  address ? cached("mine", limit) : () => EMPTY;
export const selectById = (id: string) => (state: IntentStoreState) => state.byId[id];

const EMPTY: StoredIntent[] = [];
