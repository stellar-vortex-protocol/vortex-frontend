import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { renderHook, waitFor } from "@testing-library/react";
import { SWRConfig } from "swr";
import { createElement, type ReactNode } from "react";
import { useIntents } from "./useIntents";
import type { FeedItem } from "@/lib/types";

const wrapper = ({ children }: { children: ReactNode }) =>
  createElement(SWRConfig, { value: { provider: () => new Map(), dedupingInterval: 0 } }, children);

describe("useIntents", () => {
  beforeEach(() => {
    vi.stubGlobal("fetch", vi.fn());
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("starts with an empty array and populates once the request resolves", async () => {
    const intents: FeedItem[] = [
      {
        id: "1",
        srcChain: "ethereum",
        srcToken: "USDC",
        srcAmount: "500",
        dstToken: "USDC",
        solver: "Alpha",
        status: "filled",
        createdAt: "2026-07-14T00:00:00Z",
      },
    ];
    (fetch as ReturnType<typeof vi.fn>).mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => intents,
    });

    const { result } = renderHook(() => useIntents(), { wrapper });
    expect(result.current.intents).toEqual([]);

    await waitFor(() => expect(result.current.intents).toEqual(intents));
    expect(fetch).toHaveBeenCalledWith(expect.stringContaining("/intents"), expect.anything());
  });

  it("surfaces a fetch failure as an error", async () => {
    (fetch as ReturnType<typeof vi.fn>).mockResolvedValue({
      ok: false,
      status: 500,
      statusText: "Internal Server Error",
      text: async () => "",
    });

    const { result } = renderHook(() => useIntents(), { wrapper });

    await waitFor(() => expect(result.current.error).toBeDefined());
    expect(result.current.intents).toEqual([]);
  });
});
