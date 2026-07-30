import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { renderHook, waitFor } from "@testing-library/react";
import { SWRConfig } from "swr";
import { createElement, type ReactNode } from "react";
import { useMyIntents } from "./useMyIntents";
import type { FeedItem } from "@/lib/types";

const wrapper = ({ children }: { children: ReactNode }) =>
  createElement(SWRConfig, { value: { provider: () => new Map(), dedupingInterval: 0 } }, children);

const intent: FeedItem = {
  id: "1",
  srcChain: "ethereum",
  srcToken: "USDC",
  srcAmount: "100",
  dstToken: "USDC",
  solver: "Alpha",
  status: "filled",
  createdAt: "2026-07-14T00:00:00Z",
};

describe("useMyIntents", () => {
  beforeEach(() => {
    vi.stubGlobal("fetch", vi.fn());
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("returns empty, non-loading state when address is null", () => {
    const { result } = renderHook(() => useMyIntents(null), { wrapper });
    expect(result.current.intents).toEqual([]);
    expect(result.current.isLoading).toBe(false);
    expect(result.current.error).toBeUndefined();
    expect(fetch).not.toHaveBeenCalled();
  });

  it("starts loading and populates intents when address is provided", async () => {
    (fetch as ReturnType<typeof vi.fn>).mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => [intent],
    });

    const { result } = renderHook(() => useMyIntents("GABC123"), { wrapper });

    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.intents).toEqual([intent]);
    expect(fetch).toHaveBeenCalledWith(expect.stringContaining("/intents"), expect.anything());
  });

  it("returns an empty array while loading", async () => {
    (fetch as ReturnType<typeof vi.fn>).mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => [intent],
    });

    const { result } = renderHook(() => useMyIntents("GABC123"), { wrapper });
    expect(result.current.intents).toEqual([]);

    await waitFor(() => expect(result.current.intents).toHaveLength(1));
  });

  it("surfaces a fetch failure as an error", async () => {
    (fetch as ReturnType<typeof vi.fn>).mockResolvedValue({
      ok: false,
      status: 500,
      statusText: "Internal Server Error",
      text: async () => "",
    });

    const { result } = renderHook(() => useMyIntents("GABC123"), { wrapper });

    await waitFor(() => expect(result.current.error).toBeDefined());
    expect(result.current.intents).toEqual([]);
  });

  it("does not fetch when address changes back to null", async () => {
    (fetch as ReturnType<typeof vi.fn>).mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => [intent],
    });

    const { result, rerender } = renderHook<ReturnType<typeof useMyIntents>, { addr: string | null }>(
      ({ addr }) => useMyIntents(addr),
      { wrapper, initialProps: { addr: "GABC123" } },
    );

    await waitFor(() => expect(result.current.intents).toHaveLength(1));

    rerender({ addr: null });

    expect(result.current.intents).toEqual([]);
    expect(result.current.isLoading).toBe(false);
  });

  it("returns an empty array when the endpoint returns no intents", async () => {
    (fetch as ReturnType<typeof vi.fn>).mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => [],
    });

    const { result } = renderHook(() => useMyIntents("GABC123"), { wrapper });

    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.intents).toEqual([]);
    expect(result.current.error).toBeUndefined();
  });
});
