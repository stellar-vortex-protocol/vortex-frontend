import { beforeEach, describe, expect, it } from "vitest";
import { INTENT_STORE_CAP, selectById, selectFeed, useIntentStore } from "./intents";
import type { FeedItem } from "@/lib/types";

const item = (id: string, overrides: Partial<FeedItem> = {}): FeedItem => ({
  id,
  srcChain: "ethereum",
  srcToken: "USDC",
  srcAmount: "10",
  dstToken: "USDC",
  solver: "Alpha",
  status: "pending",
  createdAt: "2026-07-14T00:00:00Z",
  ...overrides,
});

beforeEach(() => {
  useIntentStore.setState({ byId: {}, meta: {}, views: { feed: [], explore: [], mine: [] } });
});

describe("useIntentStore", () => {
  it("dedupes REST and WS copies of the same intent", () => {
    const { ingest } = useIntentStore.getState();
    ingest([item("a")], "rest", "feed");
    ingest([item("a", { status: "filled" })], "ws", "feed");
    const state = useIntentStore.getState();
    expect(state.views.feed).toEqual(["a"]);
    expect(selectById("a")(state)?.status).toBe("filled");
  });

  it("keeps existing rows when a backfill snapshot omits them", () => {
    const { ingest } = useIntentStore.getState();
    ingest([item("live")], "ws", "feed");
    ingest([item("rest")], "rest", "feed");
    expect(useIntentStore.getState().views.feed).toEqual(["live", "rest"]);
  });

  it("orders views newest first", () => {
    useIntentStore
      .getState()
      .ingest([item("old"), item("new", { createdAt: "2026-07-15T00:00:00Z" })], "rest", "feed");
    expect(useIntentStore.getState().views.feed).toEqual(["new", "old"]);
  });

  it("replaces an optimistic entry in place with the authoritative record", () => {
    const { ingest, markUnconfirmed } = useIntentStore.getState();
    ingest([{ ...item("a"), optimistic: true }], "optimistic");
    markUnconfirmed("a");
    expect(useIntentStore.getState().byId["a"]?.unconfirmed).toBe(true);
    ingest([item("a", { status: "accepted" })], "ws", "mine");
    const stored = useIntentStore.getState().byId["a"];
    expect(stored?.optimistic).toBeUndefined();
    expect(stored?.unconfirmed).toBeUndefined();
    expect(stored?.status).toBe("accepted");
  });

  it("rolls back and clears optimistic entries", () => {
    const { ingest, remove, clearOptimistic } = useIntentStore.getState();
    ingest([{ ...item("a"), optimistic: true }, { ...item("b"), optimistic: true }], "optimistic");
    remove("a");
    expect(useIntentStore.getState().byId["a"]).toBeUndefined();
    clearOptimistic();
    expect(useIntentStore.getState().views.mine).toEqual([]);
  });

  it("evicts least recently received entries beyond the cap", () => {
    const items = Array.from({ length: INTENT_STORE_CAP + 5 }, (_, i) => item(`x${i}`));
    useIntentStore.getState().ingest(items, "rest", "explore");
    expect(Object.keys(useIntentStore.getState().byId)).toHaveLength(INTENT_STORE_CAP);
  });

  it("memoises selector output while the store is unchanged", () => {
    useIntentStore.getState().ingest([item("a")], "rest", "feed");
    const sel = selectFeed(8);
    const first = sel(useIntentStore.getState());
    useIntentStore.getState().ingest([item("b")], "rest", "explore");
    expect(sel(useIntentStore.getState())).toBe(first);
  });
});
