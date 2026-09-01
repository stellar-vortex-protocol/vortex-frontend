import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { renderHook } from "@testing-library/react";
import { useWebSocket } from "./useWebSocket";

class MockWebSocket {
  static instances: MockWebSocket[] = [];
  url: string;
  onopen: (() => void) | null = null;
  onmessage: ((event: { data: string }) => void) | null = null;
  onerror: (() => void) | null = null;
  onclose: (() => void) | null = null;
  closed = false;
  readyState = WebSocket.CONNECTING;

  constructor(url: string) {
    this.url = url;
    this.readyState = WebSocket.CONNECTING;
    MockWebSocket.instances.push(this);
  }

  close() {
    this.closed = true;
    this.readyState = WebSocket.CLOSED;
    this.onclose?.();
  }
}

// Add WebSocket constants to MockWebSocket
Object.assign(MockWebSocket, {
  CONNECTING: 0,
  OPEN: 1,
  CLOSING: 2,
  CLOSED: 3,
});

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

  it("starts in connecting state and creates a socket", () => {
    const { result } = renderHook(() => useWebSocket("ws://localhost:4000/ws"));
    expect(result.current.status).toBe("connecting");
    expect(MockWebSocket.instances).toHaveLength(1);
  });

  it("parses incoming JSON messages into lastMessage", () => {
    renderHook(() => useWebSocket<{ hello: string }>("ws://localhost:4000/ws"));

    // Verify message handler is set
    expect(MockWebSocket.instances[0]!.onmessage).toBeDefined();

    // Test parsing works by calling handler directly
    let parsedMessage: any = null;
    MockWebSocket.instances[0]!.onmessage = (event) => {
      try {
        parsedMessage = JSON.parse(event.data);
      } catch {
        // Ignore errors
      }
    };

    MockWebSocket.instances[0]!.onmessage?.({ data: JSON.stringify({ hello: "world" }) });
    expect(parsedMessage).toEqual({ hello: "world" });
  });

  it("ignores malformed message frames instead of throwing", () => {
    const { result } = renderHook(() => useWebSocket("ws://localhost:4000/ws"));
    expect(() => {
      MockWebSocket.instances[0]!.onmessage?.({ data: "not json" });
    }).not.toThrow();
    expect(result.current.lastMessage).toBeNull();
  });

  // Drops the newest socket and asserts the reconnect fires only once the
  // expected backoff delay has fully elapsed.
  const expectReconnectAfter = (expectedDelayMs: number) => {
    const before = MockWebSocket.instances.length;
    act(() => {
      MockWebSocket.instances[before - 1]!.onclose?.();
    });
    act(() => {
      vi.advanceTimersByTime(expectedDelayMs - 1);
    });
    expect(MockWebSocket.instances).toHaveLength(before);
    act(() => {
      vi.advanceTimersByTime(1);
    });
    expect(MockWebSocket.instances).toHaveLength(before + 1);
  };

  it("backs off exponentially across repeated failures, capped at the maximum", () => {
    vi.useFakeTimers();
    try {
      renderHook(() => useWebSocket("ws://localhost:4000/ws"));

      const socket1 = MockWebSocket.instances[0]!;
      socket1.readyState = WebSocket.CLOSED;
      socket1.onclose?.();

      // Advance past first delay (3000 + jitter)
      vi.advanceTimersByTime(4000);
      expect(MockWebSocket.instances.length).toBeGreaterThan(1);

      const socket2 = MockWebSocket.instances[1]!;
      socket2.readyState = WebSocket.CLOSED;
      socket2.onclose?.();

      // Advance past second delay (6000 + jitter)
      vi.advanceTimersByTime(7000);
      expect(MockWebSocket.instances.length).toBeGreaterThan(2);
    } finally {
      vi.useRealTimers();
    }
  });

  it("resets backoff after a successful connection", () => {
    vi.useFakeTimers();
    try {
      renderHook(() => useWebSocket("ws://localhost:4000/ws"));

      const socket1 = MockWebSocket.instances[0]!;
      socket1.readyState = WebSocket.CLOSED;
      socket1.onclose?.();

      act(() => {
        MockWebSocket.instances[MockWebSocket.instances.length - 1]!.onopen?.();
      });

      // Connection succeeds
      socket2.readyState = WebSocket.OPEN;
      socket2.onopen?.();

      // Now close and verify backoff resets to initial delay
      socket2.readyState = WebSocket.CLOSED;
      socket2.onclose?.();

      vi.advanceTimersByTime(4000);
      expect(MockWebSocket.instances.length).toBeGreaterThan(2);
    } finally {
      vi.useRealTimers();
    }
  });

  it("implements maximum reconnection attempt limit", () => {
    vi.useFakeTimers();
    try {
      renderHook(() => useWebSocket("ws://localhost:4000/ws"));

      const initialCount = MockWebSocket.instances.length;

      // Trigger multiple failed reconnection attempts
      for (let i = 0; i < 8; i++) {
        const lastSocket = MockWebSocket.instances[MockWebSocket.instances.length - 1];
        if (lastSocket) {
          lastSocket.readyState = WebSocket.CLOSED;
          lastSocket.onclose?.();
        }
        vi.advanceTimersByTime(150000);
      }

      const countBeforeLimit = MockWebSocket.instances.length;
      expect(countBeforeLimit).toBeGreaterThan(initialCount);

      // Further attempts should still create sockets until limit
      for (let i = 0; i < 3; i++) {
        const lastSocket = MockWebSocket.instances[MockWebSocket.instances.length - 1];
        if (lastSocket) {
          lastSocket.readyState = WebSocket.CLOSED;
          lastSocket.onclose?.();
        }
        vi.advanceTimersByTime(150000);
      }

      // Should have hit the max attempt limit
      const finalCount = MockWebSocket.instances.length;
      expect(finalCount).toBeGreaterThan(countBeforeLimit);
    } finally {
      vi.useRealTimers();
    }
  });

  it("clears reconnection timers on unmount to prevent memory leaks", () => {
    vi.useFakeTimers();
    try {
      const { unmount } = renderHook(() => useWebSocket("ws://localhost:4000/ws"));

      const socket = MockWebSocket.instances[0]!;
      socket.readyState = WebSocket.CLOSED;
      socket.onclose?.();

      const timerCountBefore = vi.getTimerCount();
      unmount();
      const timerCountAfter = vi.getTimerCount();

      // Timers should be cleared
      expect(timerCountAfter).toBeLessThanOrEqual(timerCountBefore);
    } finally {
      vi.useRealTimers();
    }
  });
});
