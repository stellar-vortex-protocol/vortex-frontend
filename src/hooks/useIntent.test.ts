import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { renderHook, waitFor } from "@testing-library/react";
import { SWRConfig } from "swr";
import { createElement, type ReactNode } from "react";
import { useIntent } from "./useIntent";
import type { IntentDetail } from "@/lib/types";

const wrapper = ({ children }: { children: ReactNode }) =>
  createElement(SWRConfig, { value: { provider: () => new Map(), dedupingInterval: 0 } }, children);

const detail: IntentDetail = {
  id: "intent-1",
  srcChain: "ethereum",
  srcToken: "USDC",
  srcAmount: "500",
  dstToken: "USDC",
  dstAmount: "498.5",
  minOut: "495",
  dstAddress: "GABC123",
  solver: "Alpha",
  status: "filled",
  createdAt: "2026-07-14T00:00:00Z",
  deadline: "2026-07-14T00:20:00Z",
  txHash: "abc123",
};

describe("useIntent", () => {
  beforeEach(() => {
    vi.stubGlobal("fetch", vi.fn());
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("does not fetch when id is null", () => {
    renderHook(() => useIntent(null), { wrapper });
    expect(fetch).not.toHaveBeenCalled();
  });

  it("fetches the intent by id", async () => {
    (fetch as ReturnType<typeof vi.fn>).mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => detail,
    });

    const { result } = renderHook(() => useIntent("intent-1"), { wrapper });

    await waitFor(() => expect(result.current.intent).toEqual(detail));
    expect(fetch).toHaveBeenCalledWith(expect.stringContaining("/intents/intent-1"), expect.anything());
  });

  it("surfaces a fetch failure as an error", async () => {
    (fetch as ReturnType<typeof vi.fn>).mockResolvedValue({
      ok: false,
      status: 404,
      statusText: "Not Found",
      text: async () => "intent not found",
    });

    const { result } = renderHook(() => useIntent("missing"), { wrapper });

    await waitFor(() => expect(result.current.error).toBeDefined());
    expect(result.current.intent).toBeUndefined();
  });
});
