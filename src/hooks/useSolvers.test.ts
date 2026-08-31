import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { renderHook, waitFor } from "@testing-library/react";
import { SWRConfig } from "swr";
import { createElement, type ReactNode } from "react";
import { useSolvers } from "./useSolvers";
import type { Solver } from "@/lib/types";

const wrapper = ({ children }: { children: ReactNode }) =>
  createElement(
    SWRConfig,
    { value: { provider: () => new Map(), dedupingInterval: 0 } },
    children,
  );

describe("useSolvers", () => {
  beforeEach(() => {
    vi.stubGlobal("fetch", vi.fn());
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("starts with an empty array while loading", () => {
    (fetch as ReturnType<typeof vi.fn>).mockReturnValue(new Promise(() => {}));

    const { result } = renderHook(() => useSolvers(), { wrapper });

    expect(result.current.solvers).toEqual([]);
    expect(result.current.isLoading).toBe(true);
    expect(result.current.error).toBeUndefined();
  });

  it("populates once the request resolves", async () => {
    const solvers: Solver[] = [
      {
        name: "Alpha",
        address: "GABC123",
        bondUsd: 10000,
        fills: 42,
        failed: 1,
        volumeUsd: 500000,
        avgFillTimeSeconds: 3.2,
        successRatePct: 97.6,
        chains: ["ethereum", "stellar"],
        status: "active",
      },
    ];
    (fetch as ReturnType<typeof vi.fn>).mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => solvers,
    });

    const { result } = renderHook(() => useSolvers(), { wrapper });
    expect(result.current.solvers).toEqual([]);

    await waitFor(() => expect(result.current.solvers).toEqual(solvers));
    expect(result.current.isLoading).toBe(false);
    expect(result.current.error).toBeUndefined();
    expect(fetch).toHaveBeenCalledWith(
      expect.stringContaining("/solvers"),
      expect.anything(),
    );
  });

  it("resolves to an empty array when no solvers are returned", async () => {
    (fetch as ReturnType<typeof vi.fn>).mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => [],
    });

    const { result } = renderHook(() => useSolvers(), { wrapper });

    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.solvers).toEqual([]);
    expect(result.current.error).toBeUndefined();
  });

  it("surfaces a fetch failure as an error", async () => {
    (fetch as ReturnType<typeof vi.fn>).mockResolvedValue({
      ok: false,
      status: 500,
      statusText: "Internal Server Error",
      text: async () => "",
    });

    const { result } = renderHook(() => useSolvers(), { wrapper });

    await waitFor(() => expect(result.current.error).toBeDefined());
    expect(result.current.solvers).toEqual([]);
  });
});
