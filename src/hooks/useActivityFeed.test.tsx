import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { renderHook, waitFor } from "@testing-library/react";
import { SWRConfig } from "swr";
import type { ReactNode } from "react";
import { useActivityFeed } from "./useActivityFeed";
import type { FeedItem } from "@/lib/types";

const wrapper = ({ children }: { children: ReactNode }) => (
  <SWRConfig value={{ provider: () => new Map(), dedupingInterval: 0 }}>{children}</SWRConfig>
);

describe("useActivityFeed", () => {
  beforeEach(() => {
    vi.stubGlobal("fetch", vi.fn());
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("starts with an empty array and populates once the feed resolves", async () => {
    const feed: FeedItem[] = [
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
      json: async () => feed,
    });

    const { result } = renderHook(() => useActivityFeed(), { wrapper });

    expect(result.current.items).toEqual([]);

    await waitFor(() => {
      expect(result.current.items).toEqual(feed);
    });
    expect(result.current.isLoading).toBe(false);
  });

  it("surfaces a fetch failure as an error", async () => {
    (fetch as ReturnType<typeof vi.fn>).mockResolvedValue({
      ok: false,
      status: 500,
      statusText: "Internal Server Error",
      text: async () => "",
    });

    const { result } = renderHook(() => useActivityFeed(), { wrapper });

    await waitFor(() => {
      expect(result.current.error).toBeDefined();
    });
    expect(result.current.items).toEqual([]);
  });
});
