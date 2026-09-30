import { describe, expect, it } from "vitest";
import {
  applyEvents,
  DEFAULT_BOARD_FILTERS,
  filterAndSortIntents,
  intentUsdValue,
  isOpenIntentEvent,
  rowReducer,
  type RowState,
} from "./openIntentBoard";
import { formatTimeRemaining, secondsRemaining } from "./time";
import type { OpenIntent } from "./types";

const intent = (over: Partial<OpenIntent>): OpenIntent => ({
  id: "i",
  srcChain: "ethereum",
  srcToken: "USDC",
  srcAmount: "100",
  dstToken: "USDC",
  minOut: "99",
  deadline: "2026-01-01T00:10:00Z",
  ...over,
});

describe("formatTimeRemaining", () => {
  const now = Date.parse("2026-01-01T00:00:00Z");
  it.each([
    ["2026-01-01T00:00:45Z", "0:45"],
    ["2026-01-01T00:10:05Z", "10:05"],
    ["2026-01-01T02:03:00Z", "2h 3m"],
    ["2025-12-31T23:59:00Z", "0:00"],
    ["not-a-date", "0:00"],
  ])("%s → %s", (deadline, expected) => {
    expect(formatTimeRemaining(deadline, now)).toBe(expected);
  });

  it("reports seconds remaining (negative once passed)", () => {
    expect(secondsRemaining("2026-01-01T00:00:30Z", now)).toBe(30);
    expect(secondsRemaining("2025-12-31T23:59:30Z", now)).toBe(-30);
  });
});

describe("filterAndSortIntents", () => {
  const list = [
    intent({ id: "late", deadline: "2026-01-01T00:30:00Z" }),
    intent({ id: "soon", deadline: "2026-01-01T00:01:00Z", srcChain: "base" }),
    intent({ id: "xlm", srcToken: "ETH", srcAmount: "1" }),
    intent({ id: "priced", srcToken: "ETH", usdValue: 3000 }),
  ];

  it("sorts by soonest deadline by default", () => {
    expect(filterAndSortIntents(list, DEFAULT_BOARD_FILTERS)[0]?.id).toBe("soon");
  });

  it("filters by chain, token and min USD (unpriced intents excluded only when a minimum is set)", () => {
    expect(filterAndSortIntents(list, { ...DEFAULT_BOARD_FILTERS, chain: "base" }).map((i) => i.id)).toEqual(["soon"]);
    expect(filterAndSortIntents(list, { ...DEFAULT_BOARD_FILTERS, token: "ETH" }).map((i) => i.id).sort()).toEqual(["priced", "xlm"]);
    expect(filterAndSortIntents(list, { ...DEFAULT_BOARD_FILTERS, minUsd: 500 }).map((i) => i.id)).toEqual(["priced"]);
  });

  it("prices stablecoins and relay-priced intents only", () => {
    expect(intentUsdValue(intent({ srcToken: "usdt", srcAmount: "12.5" }))).toBe(12.5);
    expect(intentUsdValue(intent({ srcToken: "ETH" }))).toBeNull();
  });
});

describe("rowReducer", () => {
  const i = intent({ id: "a" });

  it("moves pending rows to their outcome and keeps the intent snapshot", () => {
    let s: RowState = rowReducer({}, { type: "start", intent: i });
    expect(s["a"]?.status).toBe("pending");
    s = rowReducer(s, { type: "settle", id: "a", outcome: "taken" });
    expect(s["a"]).toEqual({ status: "taken", intent: i });
    expect(rowReducer(s, { type: "remove", id: "a" })).toEqual({});
  });

  it("drops errored rows back to idle so the solver can retry", () => {
    const s = rowReducer(rowReducer({}, { type: "start", intent: i }), { type: "settle", id: "a", outcome: "error" });
    expect(s).toEqual({});
  });

  it("ignores settles for rows that are not pending", () => {
    const s = rowReducer({}, { type: "settle", id: "a", outcome: "accepted" });
    expect(s).toEqual({});
  });
});

describe("realtime events", () => {
  it("validates event shapes", () => {
    expect(isOpenIntentEvent({ type: "intent.closed", id: "a" })).toBe(true);
    expect(isOpenIntentEvent({ type: "intent.open", intent: intent({}) })).toBe(true);
    expect(isOpenIntentEvent({ type: "intent.open", intent: { id: 1 } })).toBe(false);
    expect(isOpenIntentEvent({ id: "feed-item", status: "filled" })).toBe(false);
    expect(isOpenIntentEvent(null)).toBe(false);
  });

  it("applies open/closed events over the REST snapshot", () => {
    const base = [intent({ id: "a" }), intent({ id: "b" })];
    const out = applyEvents(base, [
      { type: "intent.closed", id: "a" },
      { type: "intent.open", intent: intent({ id: "c" }) },
    ]);
    expect(out.map((x) => x.id)).toEqual(["b", "c"]);
  });
});
