import type { OpenIntent } from "./types";
import type { AcceptOutcome } from "@/hooks/useAcceptIntent";

export type BoardFilters = { chain: string; token: string; minUsd: number };
export const DEFAULT_BOARD_FILTERS: BoardFilters = { chain: "all", token: "all", minUsd: 0 };

const USD_STABLES = new Set(["USDC", "USDT", "DAI", "PYUSD"]);

/**
 * USD size of an intent: the relay's `usdValue` when present, otherwise the
 * source amount for USD stablecoins. Null when it cannot be priced — such
 * intents are hidden only when a minimum size filter is active.
 */
export function intentUsdValue(intent: OpenIntent): number | null {
  if (typeof intent.usdValue === "number" && Number.isFinite(intent.usdValue)) return intent.usdValue;
  if (USD_STABLES.has(intent.srcToken.toUpperCase())) {
    const n = Number(intent.srcAmount);
    return Number.isFinite(n) ? n : null;
  }
  return null;
}

export function filterAndSortIntents(intents: readonly OpenIntent[], f: BoardFilters): OpenIntent[] {
  return intents
    .filter((i) => {
      if (f.chain !== "all" && i.srcChain !== f.chain) return false;
      if (f.token !== "all" && i.srcToken !== f.token) return false;
      if (f.minUsd > 0) {
        const usd = intentUsdValue(i);
        if (usd === null || usd < f.minUsd) return false;
      }
      return true;
    })
    .sort(
      (a, b) =>
        new Date(a.deadline).getTime() - new Date(b.deadline).getTime() || a.id.localeCompare(b.id),
    );
}

// ── Per-row accept state ────────────────────────────────────────────────────

export type RowStatus = "pending" | Exclude<AcceptOutcome, "error"> | "error";
export type RowEntry = { status: RowStatus; intent: OpenIntent };
export type RowState = Readonly<Record<string, RowEntry>>;

export type RowAction =
  | { type: "start"; intent: OpenIntent }
  | { type: "settle"; id: string; outcome: AcceptOutcome }
  | { type: "remove"; id: string };

/**
 * Row state machine: idle → pending → accepted | taken | expired | error.
 * Only a pending row can settle; "error" rows drop back to idle so the solver
 * can retry. Accepted rows keep their intent snapshot so they stay visible
 * ("accepted by you") after the relay removes them from the open list.
 */
export function rowReducer(state: RowState, action: RowAction): RowState {
  switch (action.type) {
    case "start":
      if (state[action.intent.id]?.status === "pending") return state;
      return { ...state, [action.intent.id]: { status: "pending", intent: action.intent } };
    case "settle": {
      const row = state[action.id];
      if (!row || row.status !== "pending") return state;
      if (action.outcome === "error") {
        const next = { ...state };
        delete next[action.id];
        return next;
      }
      return { ...state, [action.id]: { ...row, status: action.outcome } };
    }
    case "remove": {
      if (!state[action.id]) return state;
      const next = { ...state };
      delete next[action.id];
      return next;
    }
  }
}

// ── Realtime buffering ──────────────────────────────────────────────────────

/** Realtime events for the open-intent queue (see docs/websocket-protocol.md). */
export type OpenIntentEvent =
  | { type: "intent.open"; intent: OpenIntent; serverTime?: string }
  | { type: "intent.closed"; id: string; serverTime?: string };

export function isOpenIntentEvent(msg: unknown): msg is OpenIntentEvent {
  if (!msg || typeof msg !== "object") return false;
  const m = msg as Record<string, unknown>;
  if (m["type"] === "intent.closed") return typeof m["id"] === "string";
  if (m["type"] === "intent.open") {
    const i = m["intent"] as Record<string, unknown> | undefined;
    return !!i && typeof i["id"] === "string" && typeof i["deadline"] === "string";
  }
  return false;
}

/** Apply live events on top of the REST snapshot (later events win). */
export function applyEvents(base: readonly OpenIntent[], events: readonly OpenIntentEvent[]): OpenIntent[] {
  const byId = new Map(base.map((i) => [i.id, i]));
  for (const e of events) {
    if (e.type === "intent.open") byId.set(e.intent.id, e.intent);
    else byId.delete(e.id);
  }
  return Array.from(byId.values());
}
