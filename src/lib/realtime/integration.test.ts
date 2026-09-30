import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, renderHook } from "@testing-library/react";
import type { WebSocketLike } from "./webSocketClient";

vi.stubEnv("NEXT_PUBLIC_WS_URL", "ws://relay.test/ws");

vi.mock("@/hooks/useActivityFeed", () => ({
  useActivityFeed: () => ({ items: [], isLoading: false, error: undefined }),
}));
vi.mock("@/hooks/useIntents", () => ({
  useIntents: () => ({ intents: [], isLoading: false, error: undefined }),
}));
vi.mock("@/hooks/useMyIntents", () => ({
  useMyIntents: () => ({ intents: [], isLoading: false, error: undefined, mutate: vi.fn() }),
}));
vi.mock("next/navigation", () => ({ usePathname: () => "/" }));

class FakeSocket implements WebSocketLike {
  static instances: FakeSocket[] = [];
  onopen: WebSocketLike["onopen"] = null;
  onmessage: WebSocketLike["onmessage"] = null;
  onerror: WebSocketLike["onerror"] = null;
  onclose: WebSocketLike["onclose"] = null;
  constructor(readonly url: string) {
    FakeSocket.instances.push(this);
  }
  close() {}
}

describe("realtime integration", () => {
  beforeEach(async () => {
    FakeSocket.instances = [];
    const { configureRealtime } = await import("./manager");
    configureRealtime({ WebSocketImpl: FakeSocket, heartbeatTimeoutMs: 0 });
  });
  afterEach(async () => {
    const { configureRealtime, resetRealtime } = await import("./manager");
    resetRealtime();
    configureRealtime({});
  });

  it("opens exactly one WebSocket across all four feed hooks and fans out messages", async () => {
    const { useIntentFeed } = await import("@/hooks/useIntentFeed");
    const { useLiveIntents } = await import("@/hooks/useLiveIntents");
    const { useMyLiveIntents } = await import("@/hooks/useMyLiveIntents");
    const { useIntentStatusWatcher } = await import("@/hooks/useIntentStatusWatcher");

    const { result } = renderHook(() => {
      useIntentStatusWatcher("GADDR");
      return {
        feed: useIntentFeed(),
        live: useLiveIntents(),
        mine: useMyLiveIntents("GADDR"),
      };
    });

    expect(FakeSocket.instances).toHaveLength(1);

    const item = {
      id: "i1",
      srcChain: "ethereum",
      srcToken: "USDC",
      srcAmount: "1",
      dstToken: "XLM",
      solver: "s",
      status: "pending",
      createdAt: new Date().toISOString(),
    };
    act(() => {
      FakeSocket.instances[0]!.onopen?.();
      FakeSocket.instances[0]!.onmessage?.({ data: JSON.stringify(item) });
    });

    expect(result.current.feed.isLive).toBe(true);
    expect(result.current.live.isLive).toBe(true);
    expect(result.current.mine.isLive).toBe(true);
    expect(result.current.feed.items.map((i) => i.id)).toEqual(["i1"]);
    expect(result.current.live.intents.map((i) => i.id)).toEqual(["i1"]);
    expect(result.current.mine.intents.map((i) => i.id)).toEqual(["i1"]);
  });
});
