import { create } from "zustand";
import { createSyncedPersist } from "@/lib/persist";
import { readChain, readQuery, readRange, readSort, readStatus } from "@/lib/searchQuery";
import { sanitizeDisplayText } from "@/lib/textSafety";
import type { MessageKey } from "@/lib/i18n";

/** Saved filter views for Explore and My Intents (#442). */

export const VIEWS_KEY = "vortex-views";
export const VIEWS_VERSION = 0;
export const MAX_VIEWS = 20;
export const MAX_VIEW_NAME_LENGTH = 40;

export type ViewScope = "explore" | "my-intents";
export type ViewParams = Record<string, string>;
export type SavedView = { id: string; name: string; scope: ViewScope; params: ViewParams };
export type BuiltInView = { id: string; nameKey: MessageKey; scopes: ViewScope[]; params: ViewParams };

export const BUILT_IN_VIEWS: readonly BuiltInView[] = [
  {
    id: "builtin:failed-7d",
    nameKey: "views.builtin.failed7d",
    scopes: ["explore", "my-intents"],
    params: { status: "failed", range: "7" },
  },
  {
    id: "builtin:large-fills",
    nameKey: "views.builtin.largeFills",
    scopes: ["explore"],
    params: { status: "filled", sort: "largest" },
  },
];

/** Keys each scope understands, with the parser that validates each value. */
const PARAM_READERS: Record<ViewScope, Record<string, (v: string) => string>> = {
  explore: { status: readStatus, chain: readChain, sort: readSort, range: readRange, q: readQuery },
  "my-intents": { status: readStatus, chain: readChain, range: readRange },
};
const DEFAULTS = new Set(["all", "newest", ""]);

// Stellar account (G...) and contract (C...) addresses: 56 base32 characters.
const STELLAR_ADDRESS_RE = /\b[GC][A-Z2-7]{55}\b/g;

/** Removes wallet/contract addresses so a shared or saved view never leaks them. */
export function stripAddresses(value: string): string {
  return value.replace(STELLAR_ADDRESS_RE, "").replace(/\s+/g, " ").trim();
}

/**
 * Validates `params` with the same parsers as the URL reader. Unknown keys and
 * values that no longer parse (e.g. a removed chain) are dropped, and
 * `degraded` tells the UI to show a notice.
 */
export function sanitizeViewParams(
  scope: ViewScope,
  params: Record<string, unknown>,
): { params: ViewParams; degraded: boolean } {
  const readers = PARAM_READERS[scope];
  const clean: ViewParams = {};
  let degraded = false;
  for (const [key, raw] of Object.entries(params)) {
    const reader = readers[key];
    if (!reader || typeof raw !== "string") {
      degraded = true;
      continue;
    }
    const value = key === "q" ? stripAddresses(reader(raw)) : reader(raw);
    if (DEFAULTS.has(value)) {
      if (!DEFAULTS.has(raw)) degraded = true;
      continue;
    }
    clean[key] = value;
  }
  return { params: clean, degraded };
}

export function viewParamsToSearch(params: ViewParams): string {
  const qs = new URLSearchParams(params).toString();
  return qs ? `?${qs}` : "";
}

/** Sanitises a user-supplied view name and resolves collisions with " (2)", " (3)"... */
export function normalizeViewName(raw: string, existing: readonly string[]): string {
  const base = sanitizeDisplayText(raw).replace(/\s+/g, " ").trim().slice(0, MAX_VIEW_NAME_LENGTH);
  if (!base) return "";
  const taken = new Set(existing.map((n) => n.toLowerCase()));
  if (!taken.has(base.toLowerCase())) return base;
  for (let n = 2; ; n += 1) {
    const suffix = ` (${n})`;
    const candidate = `${base.slice(0, MAX_VIEW_NAME_LENGTH - suffix.length)}${suffix}`;
    if (!taken.has(candidate.toLowerCase())) return candidate;
  }
}

function isSavedView(value: unknown): value is SavedView {
  if (typeof value !== "object" || value === null) return false;
  const v = value as Record<string, unknown>;
  return (
    typeof v["id"] === "string" &&
    typeof v["name"] === "string" &&
    v["name"] !== "" &&
    (v["scope"] === "explore" || v["scope"] === "my-intents") &&
    typeof v["params"] === "object" &&
    v["params"] !== null
  );
}

type PersistedViews = { views: SavedView[] };

function isPersistedViews(value: unknown): value is PersistedViews {
  return typeof value === "object" && value !== null && Array.isArray((value as Record<string, unknown>)["views"]);
}

/** Drops corrupted entries and re-validates every entry's params. */
export function sanitizeViews(value: PersistedViews): PersistedViews {
  const views = (value.views as unknown[])
    .filter(isSavedView)
    .slice(0, MAX_VIEWS)
    .map((v) => ({
      ...v,
      name: sanitizeDisplayText(v.name).slice(0, MAX_VIEW_NAME_LENGTH),
      params: sanitizeViewParams(v.scope, v.params).params,
    }));
  return { views };
}

type ViewsState = PersistedViews & {
  /** Returns the new view id, or `null` when the name is empty or the limit is reached. */
  saveView: (scope: ViewScope, name: string, params: ViewParams) => string | null;
  renameView: (id: string, name: string) => void;
  deleteView: (id: string) => void;
  /** Moves a view up (`-1`) or down (`+1`) within its scope. */
  moveView: (id: string, delta: -1 | 1) => void;
};

function newId(): string {
  return typeof crypto !== "undefined" && typeof crypto.randomUUID === "function"
    ? crypto.randomUUID()
    : `${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

export const useViewsStore = create<ViewsState>()(
  createSyncedPersist(
    (set, get) => ({
      views: [],
      saveView: (scope, name, params) => {
        const views = get().views;
        if (views.length >= MAX_VIEWS) return null;
        const clean = normalizeViewName(name, views.filter((v) => v.scope === scope).map((v) => v.name));
        if (!clean) return null;
        const id = newId();
        set({ views: [...views, { id, name: clean, scope, params: sanitizeViewParams(scope, params).params }] });
        return id;
      },
      renameView: (id, name) => {
        const views = get().views;
        const target = views.find((v) => v.id === id);
        if (!target) return;
        const others = views.filter((v) => v.scope === target.scope && v.id !== id).map((v) => v.name);
        const clean = normalizeViewName(name, others);
        if (!clean) return;
        set({ views: views.map((v) => (v.id === id ? { ...v, name: clean } : v)) });
      },
      deleteView: (id) => set({ views: get().views.filter((v) => v.id !== id) }),
      moveView: (id, delta) => {
        const views = [...get().views];
        const index = views.findIndex((v) => v.id === id);
        const target = views[index];
        if (!target) return;
        // Find the neighbouring view in the same scope.
        let swap = index + delta;
        while (swap >= 0 && swap < views.length && views[swap]?.scope !== target.scope) swap += delta;
        const neighbour = views[swap];
        if (!neighbour) return;
        views[swap] = target;
        views[index] = neighbour;
        set({ views });
      },
    }),
    {
      name: VIEWS_KEY,
      version: VIEWS_VERSION,
      partialize: (state) => ({ views: state.views }),
      validate: isPersistedViews,
      sanitize: sanitizeViews,
    },
  ),
);
