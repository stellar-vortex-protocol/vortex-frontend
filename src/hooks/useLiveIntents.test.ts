import { describe, expect, it, vi } from "vitest";
import { renderHook } from "@testing-library/react";
import type { FeedItem } from "@/lib/types";

const restItems: FeedItem[] = [
  {
    id: "rest-1",
    srcChain: "ethereum",
    srcToken: "USDC",
    srcAmount: "500",
    dstToken: "USDC",
    solver: "Alpha",
    status: "filled",
    createdAt: "2026-07-14T00:00:00Z",
  },
];

const { useIntentsMock, useWebSocketMock } = vi.hoisted(() => ({
  useIntentsMock: vi.fn(),
  useWebSocketMock: vi.fn(),
}));

vi.mock("./useIntents", () => ({ useIntents: useIntentsMock }));
vi.mock("./useWebSocket", () => ({ useWebSocket: useWebSocketMock }));

import { useLiveIntents } from "./useLiveIntents";

describe("useLiveIntents", () => {
  it("falls back to the REST list when there is no live message yet", () => {
    useIntentsMock.mockReturnValue({ intents: restItems, isLoading: false, error: undefined });
    useWebSocketMock.mockReturnValue({ status: "open", lastMessage: null });

    const { result } = renderHook(() => useLiveIntents());

    expect(result.current.intents).toEqual(restItems);
    expect(result.current.isLive).toBe(true);
  });

  it("prepends a live message ahead of the REST list, deduped by id", () => {
    const liveItem: FeedItem = { ...restItems[0], id: "live-1", solver: "Beta" };
    useIntentsMock.mockReturnValue({ intents: restItems, isLoading: false, error: undefined });
    useWebSocketMock.mockReturnValue({ status: "open", lastMessage: liveItem });

    const { result } = renderHook(() => useLiveIntents());

    expect(result.current.intents[0]).toEqual(liveItem);
    expect(result.current.intents).toHaveLength(2);
  });

  it("reports isLive as false when the socket is not open", () => {
    useIntentsMock.mockReturnValue({ intents: restItems, isLoading: false, error: undefined });
    useWebSocketMock.mockReturnValue({ status: "connecting", lastMessage: null });

    const { result } = renderHook(() => useLiveIntents());

    expect(result.current.isLive).toBe(false);
  });
});
