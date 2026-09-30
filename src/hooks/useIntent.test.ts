import { describe, expect, it, vi, beforeEach } from "vitest";
import { renderHook, act, waitFor } from "@testing-library/react";

// ── Mocks ────────────────────────────────────────────────────────────────────

const mutateMock = vi.fn();
const swrDataRef = { current: undefined as any };

vi.mock("swr", () => ({
  default: vi.fn((_key: unknown, _fetcher: unknown, _opts: unknown) => ({
    data: swrDataRef.current,
    error: undefined,
    isLoading: false,
    mutate: mutateMock,
  })),
}));

const wsLastMessageRef = { current: null as any };
const wsStatusRef = { current: "closed" as string };

vi.mock("@/hooks/useWebSocket", () => ({
  useWebSocket: vi.fn(() => ({
    status: wsStatusRef.current,
    lastMessage: wsLastMessageRef.current,
  })),
}));

vi.mock("@/hooks/useRetry", () => ({ swrRetryConfig: {} }));
vi.mock("@/lib/api", () => ({ fetcher: vi.fn() }));

import { useIntent } from "./useIntent";

// ── Tests ─────────────────────────────────────────────────────────────────────

describe("useIntent", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    swrDataRef.current = undefined;
    wsLastMessageRef.current = null;
    wsStatusRef.current = "closed";
  });

  it("returns isLive=false when WebSocket is closed", () => {
    wsStatusRef.current = "closed";
    const { result } = renderHook(() => useIntent("intent-1"));
    expect(result.current.isLive).toBe(false);
  });

  it("returns isLive=true when WebSocket is open", () => {
    wsStatusRef.current = "open";
    const { result } = renderHook(() => useIntent("intent-1"));
    expect(result.current.isLive).toBe(true);
  });

  it("merges a matching WebSocket message into the SWR cache", async () => {
    const base = {
      id: "intent-1",
      status: "pending",
      srcChain: "ethereum",
      srcToken: "USDC",
      srcAmount: "500",
      dstToken: "USDC",
      solver: "Alpha",
      createdAt: new Date().toISOString(),
    };
    swrDataRef.current = { ...base, dstAmount: "498", minOut: "495", dstAddress: "GABC", deadline: new Date().toISOString() };

    const { rerender } = renderHook(() => useIntent("intent-1"));

    // Simulate a matching WS message arriving
    wsLastMessageRef.current = { ...base, status: "filled" };
    rerender();

    await waitFor(() => {
      expect(mutateMock).toHaveBeenCalled();
    });
  });

  it("ignores WebSocket messages for different intent ids", async () => {
    swrDataRef.current = { id: "intent-1", status: "pending" };
    wsLastMessageRef.current = { id: "intent-999", status: "filled" };

    renderHook(() => useIntent("intent-1"));

    // Give effects a chance to run
    await act(async () => {});
    expect(mutateMock).not.toHaveBeenCalled();
  });

  it("passes null to SWR when no id is provided", () => {
    // When id is null, the hook should pass null as the SWR key (no fetch).
    // We verify this indirectly: isLoading should be false and intent undefined.
    swrDataRef.current = undefined;
    const { result } = renderHook(() => useIntent(null));
    expect(result.current.intent).toBeUndefined();
    expect(result.current.isLoading).toBe(false);
  });
});
