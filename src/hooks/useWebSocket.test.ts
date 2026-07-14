import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { renderHook, waitFor } from "@testing-library/react";
import { useWebSocket } from "./useWebSocket";

class MockWebSocket {
  static instances: MockWebSocket[] = [];
  url: string;
  onopen: (() => void) | null = null;
  onmessage: ((event: { data: string }) => void) | null = null;
  onerror: (() => void) | null = null;
  onclose: (() => void) | null = null;
  closed = false;

  constructor(url: string) {
    this.url = url;
    MockWebSocket.instances.push(this);
  }

  close() {
    this.closed = true;
    this.onclose?.();
  }
}

describe("useWebSocket", () => {
  beforeEach(() => {
    MockWebSocket.instances = [];
    vi.stubGlobal("WebSocket", MockWebSocket);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("stays closed and opens no socket when url is null", () => {
    const { result } = renderHook(() => useWebSocket(null));
    expect(result.current.status).toBe("closed");
    expect(MockWebSocket.instances).toHaveLength(0);
  });

  it("transitions to open once the socket connects", async () => {
    const { result } = renderHook(() => useWebSocket("ws://localhost:4000/ws"));
    expect(result.current.status).toBe("connecting");

    MockWebSocket.instances[0].onopen?.();

    await waitFor(() => expect(result.current.status).toBe("open"));
  });

  it("parses incoming JSON messages into lastMessage", async () => {
    const { result } = renderHook(() => useWebSocket<{ hello: string }>("ws://localhost:4000/ws"));
    MockWebSocket.instances[0].onmessage?.({ data: JSON.stringify({ hello: "world" }) });

    await waitFor(() => expect(result.current.lastMessage).toEqual({ hello: "world" }));
  });

  it("ignores malformed message frames instead of throwing", () => {
    const { result } = renderHook(() => useWebSocket("ws://localhost:4000/ws"));
    expect(() => {
      MockWebSocket.instances[0].onmessage?.({ data: "not json" });
    }).not.toThrow();
    expect(result.current.lastMessage).toBeNull();
  });

  it("closes the socket on unmount", () => {
    const { unmount } = renderHook(() => useWebSocket("ws://localhost:4000/ws"));
    const socket = MockWebSocket.instances[0];
    unmount();
    expect(socket.closed).toBe(true);
  });
});
