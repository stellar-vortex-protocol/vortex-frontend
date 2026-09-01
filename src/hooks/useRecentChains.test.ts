import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { buildRecentList, MAX_RECENT, RECENT_CHAINS_KEY, useRecentChains } from "./useRecentChains";

// ─── buildRecentList (pure logic) ──────────────────────────────────────────

describe("buildRecentList", () => {
  it("prepends a new chain to an empty list", () => {
    expect(buildRecentList([], "base")).toEqual(["base"]);
  });

  it("prepends a new chain to an existing list", () => {
    expect(buildRecentList(["ethereum"], "base")).toEqual(["base", "ethereum"]);
  });

  it("moves a duplicate to the front (dedup)", () => {
    expect(buildRecentList(["base", "ethereum"], "ethereum")).toEqual([
      "ethereum",
      "base",
    ]);
  });

  it("caps the list at MAX_RECENT entries", () => {
    const initial = ["base", "polygon", "arbitrum"];
    const result = buildRecentList(initial, "optimism");
    expect(result).toHaveLength(MAX_RECENT);
    expect(result[0]).toBe("optimism");
  });

  it("does not include a chain more than once even when it was first", () => {
    const result = buildRecentList(["ethereum", "base"], "ethereum");
    expect(result.filter(id => id === "ethereum")).toHaveLength(1);
  });
});

// ─── useRecentChains (hook) ──────────────────────────────────────────────────

describe("useRecentChains", () => {
  // Stub localStorage for each test.
  let store: Record<string, string> = {};

  beforeEach(() => {
    store = {};
    vi.stubGlobal("localStorage", {
      getItem: (key: string) => store[key] ?? null,
      setItem: (key: string, value: string) => { store[key] = value; },
      removeItem: (key: string) => { delete store[key]; },
      clear: () => { store = {}; },
    });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("returns an empty list when localStorage is empty", () => {
    const { result } = renderHook(() => useRecentChains());
    expect(result.current.recentChains).toEqual([]);
  });

  it("persists a selected chain to localStorage", () => {
    const { result } = renderHook(() => useRecentChains());
    act(() => result.current.addRecentChain("base"));
    expect(store[RECENT_CHAINS_KEY]).toContain("base");
  });

  it("surfaces the stored chain as a full chain object", () => {
    const { result } = renderHook(() => useRecentChains());
    act(() => result.current.addRecentChain("base"));
    expect(result.current.recentChains[0]).toMatchObject({ id: "base", name: "Base" });
  });

  it("keeps the most recently used chain first", () => {
    const { result } = renderHook(() => useRecentChains());
    act(() => result.current.addRecentChain("ethereum"));
    act(() => result.current.addRecentChain("base"));
    expect(result.current.recentChains[0].id).toBe("base");
  });

  it("deduplicates — re-selecting a chain moves it to the top", () => {
    const { result } = renderHook(() => useRecentChains());
    act(() => result.current.addRecentChain("ethereum"));
    act(() => result.current.addRecentChain("base"));
    act(() => result.current.addRecentChain("ethereum"));
    const ids = result.current.recentChains.map(c => c.id);
    expect(ids[0]).toBe("ethereum");
    expect(ids.filter(id => id === "ethereum")).toHaveLength(1);
  });

  it("caps at MAX_RECENT entries", () => {
    const { result } = renderHook(() => useRecentChains());
    act(() => result.current.addRecentChain("ethereum"));
    act(() => result.current.addRecentChain("base"));
    act(() => result.current.addRecentChain("polygon"));
    act(() => result.current.addRecentChain("arbitrum"));
    expect(result.current.recentChains).toHaveLength(MAX_RECENT);
  });

  it("filters out stale chain IDs that no longer exist in CHAINS", () => {
    // Seed localStorage with a chain that doesn't exist.
    store[RECENT_CHAINS_KEY] = JSON.stringify(["ethereum", "nonexistent-chain"]);
    const { result } = renderHook(() => useRecentChains());
    const ids = result.current.recentChains.map(c => c.id);
    expect(ids).not.toContain("nonexistent-chain");
    expect(ids).toContain("ethereum");
  });

  it("handles corrupt localStorage gracefully (returns empty list)", () => {
    store[RECENT_CHAINS_KEY] = "not-valid-json{{{{";
    const { result } = renderHook(() => useRecentChains());
    expect(result.current.recentChains).toEqual([]);
  });
});
