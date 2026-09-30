import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, renderHook } from "@testing-library/react";
import { configureRealtime, resetRealtime } from "@/lib/realtime/manager";
import type { WebSocketLike } from "@/lib/realtime/webSocketClient";
import { useWebSocket } from "./useWebSocket";

class MockWebSocket implements WebSocketLike {
  static instances: MockWebSocket[] = [];
  onopen: WebSocketLike["onopen"] = null;
  onmessage: WebSocketLike["onmessage"] = null;
  onerror: WebSocketLike["onerror"] = null;
  onclose: WebSocketLike["onclose"] = null;
  closed = false;
  constructor(readonly url: string) {
    MockWebSocket.instances.push(this);
  }
  close() {
    this.closed = true;
  }
}

const URL = "ws://localhost:4000/ws";

describe("useWebSocket", () => {
  beforeEach(() => {
    MockWebSocket.instances = [];
    configureRealtime({ WebSocketImpl: MockWebSocket, random: () => 0.5 });
  });

  afterEach(() => {
    resetRealtime();
    configureRealtime({});
    vi.useRealTimers();
  });

  it("stays closed and opens no socket when url is null", () => {
    const { result } = renderHook(() => useWebSocket(null));
    expect(result.current.status).toBe("closed");
    expect(MockWebSocket.instances).toHaveLength(0);
  });

  it("starts in connecting state and creates a socket", () => {
    const { result } = renderHook(() => useWebSocket(URL));
    expect(result.current.status).toBe("connecting");
    expect(MockWebSocket.instances).toHaveLength(1);
  });

  it("does not reconnect on connecting → open transitions (regression)", () => {
    const { result } = renderHook(() => useWebSocket(URL));
    act(() => MockWebSocket.instances[0]!.onopen?.());
    expect(result.current.status).toBe("open");
    expect(MockWebSocket.instances).toHaveLength(1);
    expect(MockWebSocket.instances[0]!.closed).toBe(false);
  });

  it("parses incoming JSON messages into lastMessage and ignores malformed frames", () => {
    const { result } = renderHook(() => useWebSocket<{ hello: string }>(URL));
    act(() => MockWebSocket.instances[0]!.onmessage?.({ data: "not json" }));
    expect(result.current.lastMessage).toBeNull();
    act(() => MockWebSocket.instances[0]!.onmessage?.({ data: '{"hello":"world"}' }));
    expect(result.current.lastMessage).toEqual({ hello: "world" });
  });

  it("shares one socket between hooks with the same url", () => {
    renderHook(() => useWebSocket(URL));
    renderHook(() => useWebSocket(URL));
    expect(MockWebSocket.instances).toHaveLength(1);
  });

  it("reconnects after the backoff delay and exposes manual reconnect()", () => {
    vi.useFakeTimers();
    const { result } = renderHook(() => useWebSocket(URL));
    act(() => MockWebSocket.instances[0]!.onclose?.({ code: 1006 }));
    expect(result.current.status).toBe("backoff");
    act(() => vi.advanceTimersByTime(3000));
    expect(MockWebSocket.instances).toHaveLength(2);
    act(() => result.current.reconnect());
    expect(MockWebSocket.instances).toHaveLength(3);
  });
});
