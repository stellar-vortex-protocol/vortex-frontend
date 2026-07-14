import { describe, expect, it, vi } from "vitest";
import { renderHook } from "@testing-library/react";
import type { FeedItem } from "@/lib/types";

const seedItems: FeedItem[] = [
  {
    id: "seed-1",
    srcChain: "ethereum",
    srcToken: "USDC",
    srcAmount: "500",
    dstToken: "USDC",
    solver: "Alpha",
    status: "filled",
    createdAt: "2026-07-14T00:00:00Z",
  },
];

const { useActivityFeedMock, useWebSocketMock } = vi.hoisted(() => ({
  useActivityFeedMock: vi.fn(),
  useWebSocketMock: vi.fn(),
}));

vi.mock("./useActivityFeed", () => ({ useActivityFeed: useActivityFeedMock }));
vi.mock("./useWebSocket", () => ({ useWebSocket: useWebSocketMock }));

import { useIntentFeed } from "./useIntentFeed";

describe("useIntentFeed", () => {
  it("falls back to the REST snapshot when there is no live message yet", () => {
    useActivityFeedMock.mockReturnValue({ items: seedItems, isLoading: false, error: undefined });
    useWebSocketMock.mockReturnValue({ status: "open", lastMessage: null });

    const { result } = renderHook(() => useIntentFeed());

    expect(result.current.items).toEqual(seedItems);
    expect(result.current.isLive).toBe(true);
  });

  it("prepends a live message ahead of the REST snapshot", () => {
    const liveItem: FeedItem = { ...seedItems[0], id: "live-1", solver: "Beta" };
    useActivityFeedMock.mockReturnValue({ items: seedItems, isLoading: false, error: undefined });
    useWebSocketMock.mockReturnValue({ status: "open", lastMessage: liveItem });

    const { result } = renderHook(() => useIntentFeed());

    expect(result.current.items[0]).toEqual(liveItem);
    expect(result.current.items).toHaveLength(2);
  });

  it("reports isLive as false when the socket is not open", () => {
    useActivityFeedMock.mockReturnValue({ items: seedItems, isLoading: false, error: undefined });
    useWebSocketMock.mockReturnValue({ status: "connecting", lastMessage: null });

    const { result } = renderHook(() => useIntentFeed());

    expect(result.current.isLive).toBe(false);
  });
});
