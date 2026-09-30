import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, renderHook, waitFor } from "@testing-library/react";
import { SWRConfig } from "swr";
import { createElement, type ReactNode } from "react";
import { getIntentsPageKey, useIntentsPage } from "./useIntentsPage";
import { feedItem, jsonResponse } from "@/test/fixtures/api";

const wrapper = ({ children }: { children: ReactNode }) =>
  createElement(SWRConfig, { value: { provider: () => new Map(), dedupingInterval: 0 } }, children);

describe("getIntentsPageKey", () => {
  it("builds cursor keys and stops at the last page", () => {
    const key = getIntentsPageKey({ status: "filled", chain: "all" }, "oldest", 10);
    expect(key(0, null)).toBe("/intents?limit=10&status=filled&sort=oldest");
    expect(key(1, { items: [], nextCursor: "abc" })).toBe("/intents?limit=10&status=filled&sort=oldest&cursor=abc");
    expect(key(1, { items: [], nextCursor: null })).toBeNull();
  });
});

describe("useIntentsPage", () => {
  beforeEach(() => vi.stubGlobal("fetch", vi.fn()));
  afterEach(() => vi.unstubAllGlobals());

  it("loads pages, dedups ids and reports the end of results", async () => {
    const f = fetch as ReturnType<typeof vi.fn>;
    f.mockResolvedValueOnce(jsonResponse({ items: [feedItem], nextCursor: "c1" }));
    f.mockResolvedValueOnce(jsonResponse({ items: [feedItem, { ...feedItem, id: "int_9" }], nextCursor: null }));

    const { result } = renderHook(() => useIntentsPage(), { wrapper });
    await waitFor(() => expect(result.current.intents).toHaveLength(1));
    expect(result.current.hasMore).toBe(true);

    act(() => result.current.loadMore());
    await waitFor(() => expect(result.current.intents.map((i) => i.id)).toEqual(["int_1", "int_9"]));
    expect(result.current.hasMore).toBe(false);
    expect(String(f.mock.calls[1]![0])).toContain("cursor=c1");
  });

  it("supports the legacy unpaginated array response", async () => {
    (fetch as ReturnType<typeof vi.fn>).mockResolvedValue(jsonResponse([feedItem]));
    const { result } = renderHook(() => useIntentsPage(), { wrapper });
    await waitFor(() => expect(result.current.intents).toHaveLength(1));
    expect(result.current.hasMore).toBe(false);
  });
});
