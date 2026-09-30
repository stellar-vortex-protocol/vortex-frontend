import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { WebSocketClient, type WebSocketLike } from "./webSocketClient";

class FakeSocket implements WebSocketLike {
  static instances: FakeSocket[] = [];
  onopen: WebSocketLike["onopen"] = null;
  onmessage: WebSocketLike["onmessage"] = null;
  onerror: WebSocketLike["onerror"] = null;
  onclose: WebSocketLike["onclose"] = null;
  closed = false;
  sent: string[] = [];
  constructor(readonly url: string) {
    FakeSocket.instances.push(this);
  }
  close() {
    this.closed = true;
  }
  send(data: string) {
    this.sent.push(data);
  }
}

const last = () => FakeSocket.instances[FakeSocket.instances.length - 1]!;

function makeClient(extra: Record<string, unknown> = {}) {
  return new WebSocketClient("ws://test", {
    WebSocketImpl: FakeSocket,
    random: () => 0.5, // zero jitter → exact schedule
    heartbeatTimeoutMs: 0,
    ...extra,
  });
}

describe("WebSocketClient", () => {
  beforeEach(() => {
    FakeSocket.instances = [];
    vi.useFakeTimers();
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it("starts idle and moves connecting → open without reconnecting", () => {
    const client = makeClient();
    const states: string[] = [];
    client.onState((s) => states.push(s));
    expect(client.getState()).toBe("idle");
    client.connect();
    last().onopen?.();
    vi.advanceTimersByTime(60000);
    expect(states).toEqual(["connecting", "open"]);
    expect(FakeSocket.instances).toHaveLength(1);
    expect(last().closed).toBe(false);
  });

  it("connect() is a no-op while already active", () => {
    const client = makeClient();
    client.connect();
    client.connect();
    expect(FakeSocket.instances).toHaveLength(1);
  });

  it("reconnects on the exact exponential schedule, capped at the max", () => {
    const client = makeClient({ initialDelayMs: 1000, maxDelayMs: 4000 });
    client.connect();
    for (const delay of [1000, 2000, 4000, 4000]) {
      const before = FakeSocket.instances.length;
      last().onclose?.({ code: 1006 });
      expect(client.getState()).toBe("backoff");
      vi.advanceTimersByTime(delay - 1);
      expect(FakeSocket.instances).toHaveLength(before);
      vi.advanceTimersByTime(1);
      expect(FakeSocket.instances).toHaveLength(before + 1);
    }
  });

  it("applies bounded jitter", () => {
    const low = makeClient({ random: () => 0 });
    const high = makeClient({ random: () => 1 });
    expect(low.nextDelay()).toBe(2400);
    expect(high.nextDelay()).toBe(3600);
  });

  it("becomes unavailable after maxAttempts and reconnect() recovers", () => {
    const client = makeClient({ maxAttempts: 2, initialDelayMs: 10 });
    client.connect();
    last().onclose?.();
    vi.advanceTimersByTime(10);
    last().onclose?.();
    vi.advanceTimersByTime(20);
    expect(client.getState()).toBe("unavailable");
    const count = FakeSocket.instances.length;
    client.reconnect();
    expect(FakeSocket.instances).toHaveLength(count + 1);
    expect(client.getState()).toBe("connecting");
    expect(client.getAttempts()).toBe(0);
  });

  it("resets attempts only after a stable open", () => {
    const client = makeClient({ initialDelayMs: 1000, stableAfterMs: 10000 });
    client.connect();
    last().onclose?.();
    vi.advanceTimersByTime(1000);
    last().onopen?.();
    vi.advanceTimersByTime(5000); // not yet stable
    expect(client.getAttempts()).toBe(1);
    vi.advanceTimersByTime(5000);
    expect(client.getAttempts()).toBe(0);
  });

  it("does not reset attempts when the open is short-lived", () => {
    const client = makeClient({ initialDelayMs: 1000, stableAfterMs: 10000 });
    client.connect();
    last().onclose?.();
    vi.advanceTimersByTime(1000);
    last().onopen?.();
    last().onclose?.();
    expect(client.getAttempts()).toBe(2);
  });

  it("treats policy-violation close codes as unavailable", () => {
    const client = makeClient();
    client.connect();
    last().onclose?.({ code: 1008 });
    expect(client.getState()).toBe("unavailable");
  });

  it("reconnects when the heartbeat watchdog expires", () => {
    const client = makeClient({ heartbeatTimeoutMs: 5000, initialDelayMs: 100 });
    client.connect();
    const first = last();
    first.onopen?.();
    vi.advanceTimersByTime(4000);
    first.onmessage?.({ data: "{}" }); // re-arms the watchdog
    vi.advanceTimersByTime(4999);
    expect(first.closed).toBe(false);
    vi.advanceTimersByTime(1);
    expect(first.closed).toBe(true);
    expect(client.getState()).toBe("backoff");
    vi.advanceTimersByTime(100);
    expect(FakeSocket.instances).toHaveLength(2);
  });

  it("parses JSON messages and ignores malformed frames", () => {
    const client = makeClient();
    const got: unknown[] = [];
    client.onMessage((m) => got.push(m));
    client.connect();
    last().onmessage?.({ data: "not json" });
    last().onmessage?.({ data: '{"a":1}' });
    expect(got).toEqual([{ a: 1 }]);
  });

  it("ignores late events from replaced sockets", () => {
    const client = makeClient();
    client.connect();
    const stale = last();
    client.reconnect();
    stale.onclose?.();
    expect(client.getState()).toBe("connecting");
    expect(FakeSocket.instances).toHaveLength(2);
  });

  it("pauses while offline and retries immediately on resume", () => {
    const client = makeClient();
    client.connect();
    client.pause();
    expect(last().closed).toBe(true);
    vi.advanceTimersByTime(120000);
    expect(FakeSocket.instances).toHaveLength(1);
    client.resume();
    expect(FakeSocket.instances).toHaveLength(2);
    client.resume(); // no-op when not paused
    expect(FakeSocket.instances).toHaveLength(2);
  });

  it("close() clears timers and detaches listeners", () => {
    const client = makeClient();
    client.connect();
    last().onclose?.();
    client.close();
    expect(client.getState()).toBe("closed");
    vi.advanceTimersByTime(120000);
    expect(FakeSocket.instances).toHaveLength(1);
    expect(vi.getTimerCount()).toBe(0);
  });

  it("send() only writes while open", () => {
    const client = makeClient();
    client.connect();
    expect(client.send({ x: 1 })).toBe(false);
    last().onopen?.();
    expect(client.send({ x: 1 })).toBe(true);
    expect(last().sent).toEqual(['{"x":1}']);
  });
});
