import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, renderHook, waitFor } from "@testing-library/react";
import { SWRConfig } from "swr";
import type { ReactNode } from "react";
import type { WebSocketLike } from "@/lib/realtime/webSocketClient";

vi.stubEnv("NEXT_PUBLIC_WS_URL", "ws://relay.test/ws");

const detail = {
  id: "i1",
  srcChain: "base",
  srcToken: "USDC",
  srcAmount: "25",
  dstToken: "XLM",
  solver: "s",
  status: "pending",
  createdAt: new Date(Date.now() - 60_000).toISOString(),
  deadline: new Date(Date.now() + 600_000).toISOString(),
  dstAmount: "200",
  minOut: "199",
  dstAddress: "GDEST",
};
vi.mock("@/lib/api", () => ({ fetcher: vi.fn(async () => detail) }));

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

const wrapper = ({ children }: { children: ReactNode }) => (
  <SWRConfig value={{ provider: () => new Map() }}>{children}</SWRConfig>
);

describe("useIntentLifecycle", () => {
  beforeEach(async () => {
    FakeSocket.instances = [];
    window.localStorage.clear();
    const { configureRealtime } = await import("@/lib/realtime/manager");
    configureRealtime({ WebSocketImpl: FakeSocket, heartbeatTimeoutMs: 0 });
  });
  afterEach(async () => {
    const { configureRealtime, resetRealtime } = await import("@/lib/realtime/manager");
    resetRealtime();
    configureRealtime({});
  });

  it("merges REST detail with live WS updates for the same intent only", async () => {
    const { useIntentLifecycle } = await import("./useIntentLifecycle");
    const { result } = renderHook(() => useIntentLifecycle("i1"), { wrapper });
    await waitFor(() => expect(result.current.view?.phase).toBe("pending"));

    const socket = FakeSocket.instances[0]!;
    act(() => {
      socket.onopen?.();
      socket.onmessage?.({ data: JSON.stringify({ ...detail, id: "other", status: "filled" }) });
    });
    expect(result.current.view?.phase).toBe("pending");

    act(() => socket.onmessage?.({ data: JSON.stringify({ ...detail, status: "accepted" }) }));
    expect(result.current.view?.phase).toBe("accepted");
    expect(result.current.view?.steps[1]?.at).toBeDefined();

    // Out-of-order stale frame must not regress the status.
    act(() => socket.onmessage?.({ data: JSON.stringify({ ...detail, status: "pending" }) }));
    expect(result.current.view?.phase).toBe("accepted");

    act(() => socket.onmessage?.({ data: JSON.stringify({ ...detail, status: "filled" }) }));
    expect(result.current.view?.phase).toBe("filled");
    expect(result.current.view?.isTerminal).toBe(true);
  });

  it("stays idle without an id", async () => {
    const { useIntentLifecycle } = await import("./useIntentLifecycle");
    const { result } = renderHook(() => useIntentLifecycle(null), { wrapper });
    expect(result.current.view).toBeNull();
    expect(FakeSocket.instances).toHaveLength(0);
  });

  it("tracks the persisted last submitted intent", async () => {
    const { useLastSubmittedIntent } = await import("./useIntentLifecycle");
    const { result } = renderHook(() => useLastSubmittedIntent());
    expect(result.current[0]).toBeNull();
    act(() => result.current[1]("i9"));
    expect(result.current[0]).toBe("i9");
    act(() => result.current[1](null));
    expect(result.current[0]).toBeNull();
  });
});
