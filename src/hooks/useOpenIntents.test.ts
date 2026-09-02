import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { renderHook, waitFor } from "@testing-library/react";
import { SWRConfig } from "swr";
import { createElement, type ReactNode } from "react";
import { useOpenIntents } from "./useOpenIntents";
import type { OpenIntent } from "@/lib/types";

const wrapper = ({ children }: { children: ReactNode }) =>
  createElement(
    SWRConfig,
    { value: { provider: () => new Map(), dedupingInterval: 0 } },
    children,
  );

describe("useOpenIntents", () => {
  beforeEach(() => {
    vi.stubGlobal("fetch", vi.fn());
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("starts with an empty array while loading", () => {
    (fetch as ReturnType<typeof vi.fn>).mockReturnValue(new Promise(() => {}));

    const { result } = renderHook(() => useOpenIntents(), { wrapper });

    expect(result.current.intents).toEqual([]);
    expect(result.current.isLoading).toBe(true);
    expect(result.current.error).toBeUndefined();
  });

  it("populates once the request resolves", async () => {
    const intents: OpenIntent[] = [
      {
        id: "1",
        srcChain: "ethereum",
        srcToken: "USDC",
        srcAmount: "500",
        dstToken: "XLM",
        minOut: "490",
        deadline: "2026-07-14T00:00:00Z",
      },
    ];
    (fetch as ReturnType<typeof vi.fn>).mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => intents,
    });

    const { result } = renderHook(() => useOpenIntents(), { wrapper });
    expect(result.current.intents).toEqual([]);

    await waitFor(() => expect(result.current.intents).toEqual(intents));
    expect(result.current.isLoading).toBe(false);
    expect(result.current.error).toBeUndefined();
    expect(fetch).toHaveBeenCalledWith(
      expect.stringContaining("/intents/open"),
      expect.anything(),
    );
  });

  it("resolves to an empty array when there are no open intents", async () => {
    (fetch as ReturnType<typeof vi.fn>).mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => [],
    });

    const { result } = renderHook(() => useOpenIntents(), { wrapper });

    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.intents).toEqual([]);
    expect(result.current.error).toBeUndefined();
  });

  it("surfaces a fetch failure as an error", async () => {
    (fetch as ReturnType<typeof vi.fn>).mockResolvedValue({
      ok: false,
      status: 500,
      statusText: "Internal Server Error",
      text: async () => "",
    });

    const { result } = renderHook(() => useOpenIntents(), { wrapper });

    await waitFor(() => expect(result.current.error).toBeDefined());
    expect(result.current.intents).toEqual([]);
  });
});
