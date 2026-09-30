import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  configureRealtime,
  getRealtimeDebugInfo,
  LINGER_MS,
  resetRealtime,
  subscribe,
  watchStatus,
} from "./manager";
import type { WebSocketLike } from "./webSocketClient";

class FakeSocket implements WebSocketLike {
  static instances: FakeSocket[] = [];
  onopen: WebSocketLike["onopen"] = null;
  onmessage: WebSocketLike["onmessage"] = null;
  onerror: WebSocketLike["onerror"] = null;
  onclose: WebSocketLike["onclose"] = null;
  closed = false;
  constructor(readonly url: string) {
    FakeSocket.instances.push(this);
  }
  close() {
    this.closed = true;
  }
}

const WS = "ws://test";
const emit = (data: unknown) =>
  FakeSocket.instances[0]!.onmessage?.({ data: JSON.stringify(data) });

describe("realtime manager", () => {
  beforeEach(() => {
    FakeSocket.instances = [];
    vi.useFakeTimers();
    configureRealtime({ WebSocketImpl: FakeSocket, heartbeatTimeoutMs: 0 });
  });
  afterEach(() => {
    resetRealtime();
    configureRealtime({});
    vi.useRealTimers();
  });

  it("opens one socket for many subscribers and closes after the last leaves (with linger)", () => {
    const a = subscribe(WS, "intents", () => {});
    const b = subscribe(WS, "intents", () => {});
    const c = watchStatus(WS, () => {});
    expect(FakeSocket.instances).toHaveLength(1);
    a();
    b();
    c();
    vi.advanceTimersByTime(LINGER_MS - 1);
    expect(FakeSocket.instances[0]!.closed).toBe(false);
    vi.advanceTimersByTime(1);
    expect(FakeSocket.instances[0]!.closed).toBe(true);
    expect(getRealtimeDebugInfo()).toEqual([]);
  });

  it("re-subscribing within the linger window reuses the socket", () => {
    const a = subscribe(WS, "intents", () => {});
    a();
    vi.advanceTimersByTime(LINGER_MS / 2);
    subscribe(WS, "intents", () => {});
    vi.advanceTimersByTime(LINGER_MS * 2);
    expect(FakeSocket.instances).toHaveLength(1);
    expect(FakeSocket.instances[0]!.closed).toBe(false);
  });

  it("routes by topic and applies filters", () => {
    const intents = vi.fn();
    const filtered = vi.fn();
    const other = vi.fn();
    subscribe(WS, "intents", intents);
    subscribe<{ id: string }>(WS, "intents", filtered, (m) => m.id === "x");
    subscribe(WS, "solvers", other);
    emit({ id: "y" });
    emit({ id: "x" });
    emit({ topic: "solvers", id: "s" });
    expect(intents).toHaveBeenCalledTimes(2);
    expect(filtered).toHaveBeenCalledTimes(1);
    expect(other).toHaveBeenCalledWith({ topic: "solvers", id: "s" });
  });

  it("isolates subscriber exceptions from other subscribers", () => {
    const errSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    const good = vi.fn();
    subscribe(WS, "intents", () => {
      throw new Error("boom");
    });
    subscribe(WS, "intents", good);
    emit({ id: "1" });
    expect(good).toHaveBeenCalledTimes(1);
    errSpy.mockRestore();
  });

  it("reports status to watchers immediately and on change", () => {
    const states: string[] = [];
    watchStatus(WS, (s) => states.push(s));
    FakeSocket.instances[0]!.onopen?.();
    expect(states).toEqual(["connecting", "open"]);
  });

  it("pauses on offline and reconnects on online", () => {
    subscribe(WS, "intents", () => {});
    window.dispatchEvent(new Event("offline"));
    expect(FakeSocket.instances[0]!.closed).toBe(true);
    window.dispatchEvent(new Event("online"));
    expect(FakeSocket.instances).toHaveLength(2);
  });

  it("lists connections and subscriber counts for the debug overlay", () => {
    subscribe(WS, "intents", () => {});
    subscribe(WS, "intents", () => {});
    expect(getRealtimeDebugInfo()).toEqual([
      { url: WS, state: "connecting", subscribers: { intents: 2 } },
    ]);
  });
});
