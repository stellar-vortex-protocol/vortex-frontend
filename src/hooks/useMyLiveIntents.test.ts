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

const { useMyIntentsMock, useWebSocketMock } = vi.hoisted(() => ({
  useMyIntentsMock: vi.fn(),
  useWebSocketMock: vi.fn(),
}));

vi.mock("./useMyIntents", () => ({ useMyIntents: useMyIntentsMock }));
vi.mock("./useWebSocket", () => ({ useWebSocket: useWebSocketMock }));

import { useMyLiveIntents } from "./useMyLiveIntents";

describe("useMyLiveIntents", () => {
  const address = "GABC123";

  it("falls back to the REST list when there is no live message yet", () => {
    useMyIntentsMock.mockReturnValue({ intents: restItems, isLoading: false, error: undefined });
    useWebSocketMock.mockReturnValue({ status: "open", lastMessage: null });

    const { result } = renderHook(() => useMyLiveIntents(address));

    expect(result.current.intents).toEqual(restItems);
    expect(result.current.isLive).toBe(true);
  });

  it("prepends a live message ahead of the REST list, deduped by id", () => {
    const liveItem: FeedItem = { ...restItems[0]!, id: "live-1", solver: "Beta" };
    useMyIntentsMock.mockReturnValue({ intents: restItems, isLoading: false, error: undefined });
    useWebSocketMock.mockReturnValue({ status: "open", lastMessage: liveItem });

    const { result } = renderHook(() => useMyLiveIntents(address));

    expect(result.current.intents[0]).toEqual(liveItem);
    expect(result.current.intents).toHaveLength(2);
  });

  it("reports isLive as false when the socket is not open", () => {
    useMyIntentsMock.mockReturnValue({ intents: restItems, isLoading: false, error: undefined });
    useWebSocketMock.mockReturnValue({ status: "connecting", lastMessage: null });

    const { result } = renderHook(() => useMyLiveIntents(address));

    expect(result.current.isLive).toBe(false);
  });

  it("closes the WebSocket when address is null", () => {
    useMyIntentsMock.mockReturnValue({ intents: restItems, isLoading: false, error: undefined });
    useWebSocketMock.mockReturnValue({ status: "closed", lastMessage: null });

    renderHook(() => useMyLiveIntents(null));

    expect(useWebSocketMock).toHaveBeenCalledWith(null);
  });

  it("updates status when a live message arrives", () => {
    const initialItem: FeedItem = { ...restItems[0]!, status: "pending" };
    const updatedItem: FeedItem = { ...initialItem, status: "filled" };

    useMyIntentsMock.mockReturnValue({ intents: [initialItem], isLoading: false, error: undefined });
    useWebSocketMock.mockReturnValue({ status: "open", lastMessage: updatedItem });

    const { result } = renderHook(() => useMyLiveIntents(address));

    expect(result.current.intents[0]!.status).toBe("filled");
  });
});
