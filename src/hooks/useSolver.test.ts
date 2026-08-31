import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { renderHook, waitFor } from "@testing-library/react";
import { SWRConfig } from "swr";
import { createElement, type ReactNode } from "react";
import { useSolver } from "./useSolver";
import type { Solver } from "@/lib/types";

const wrapper = ({ children }: { children: ReactNode }) =>
  createElement(
    SWRConfig,
    { value: { provider: () => new Map(), dedupingInterval: 0 } },
    children,
  );

const mockSolver: Solver = {
  name: "AlphaMax",
  address: "GBRPYHIL2CI3WHZDTOOQFC6EB4CGQOFN4QO5JTJVSXBLEDSOMETHING",
  bondUsd: 5000,
  fills: 150,
  failed: 3,
  volumeUsd: 2500000,
  avgFillTimeSeconds: 8.5,
  successRatePct: 98.0,
  chains: ["ethereum", "polygon", "base"],
  status: "active",
};

describe("useSolver", () => {
  beforeEach(() => {
    vi.stubGlobal("fetch", vi.fn());
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("does not fetch when address is null", () => {
    renderHook(() => useSolver(null), { wrapper });
    expect(fetch).not.toHaveBeenCalled();
  });

  it("starts in loading state with undefined solver when address is provided", () => {
    (fetch as ReturnType<typeof vi.fn>).mockReturnValue(new Promise(() => {}));

    const { result } = renderHook(
      () =>
        useSolver("GBRPYHIL2CI3WHZDTOOQFC6EB4CGQOFN4QO5JTJVSXBLEDSOMETHING"),
      { wrapper },
    );

    expect(result.current.solver).toBeUndefined();
    expect(result.current.isLoading).toBe(true);
    expect(result.current.error).toBeUndefined();
  });

  it("fetches solver by address and returns data", async () => {
    (fetch as ReturnType<typeof vi.fn>).mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => mockSolver,
    });

    const { result } = renderHook(
      () =>
        useSolver("GBRPYHIL2CI3WHZDTOOQFC6EB4CGQOFN4QO5JTJVSXBLEDSOMETHING"),
      { wrapper },
    );

    await waitFor(() => expect(result.current.solver).toEqual(mockSolver));
    expect(result.current.isLoading).toBe(false);
    expect(result.current.error).toBeUndefined();
    expect(fetch).toHaveBeenCalledWith(
      expect.stringContaining(
        "/solvers/GBRPYHIL2CI3WHZDTOOQFC6EB4CGQOFN4QO5JTJVSXBLEDSOMETHING",
      ),
      expect.anything(),
    );
  });

  it("uses the address in the request URL", async () => {
    const customAddress =
      "GCUSTOM00000000000000000000000000000000000000000000000";
    (fetch as ReturnType<typeof vi.fn>).mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ ...mockSolver, address: customAddress }),
    });

    const { result } = renderHook(() => useSolver(customAddress), { wrapper });

    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(fetch).toHaveBeenCalledWith(
      expect.stringContaining(`/solvers/${customAddress}`),
      expect.anything(),
    );
  });

  it("surfaces a 404 as an error and leaves solver undefined", async () => {
    (fetch as ReturnType<typeof vi.fn>).mockResolvedValue({
      ok: false,
      status: 404,
      statusText: "Not Found",
      text: async () => "solver not found",
    });

    const { result } = renderHook(
      () => useSolver("NONEXISTENT0000000000000000000000000000000000000000000"),
      { wrapper },
    );

    await waitFor(() => expect(result.current.error).toBeDefined());
    expect(result.current.solver).toBeUndefined();
    expect(result.current.isLoading).toBe(false);
  });

  it("surfaces a 500 server error as an error and leaves solver undefined", async () => {
    (fetch as ReturnType<typeof vi.fn>).mockResolvedValue({
      ok: false,
      status: 500,
      statusText: "Internal Server Error",
      text: async () => "",
    });

    const { result } = renderHook(
      () =>
        useSolver("GBRPYHIL2CI3WHZDTOOQFC6EB4CGQOFN4QO5JTJVSXBLEDSOMETHING"),
      { wrapper },
    );

    await waitFor(() => expect(result.current.error).toBeDefined());
    expect(result.current.solver).toBeUndefined();
    expect(result.current.isLoading).toBe(false);
  });

  it("surfaces a network failure as an error", async () => {
    (fetch as ReturnType<typeof vi.fn>).mockRejectedValue(
      new Error("Network error"),
    );

    const { result } = renderHook(
      () =>
        useSolver("GBRPYHIL2CI3WHZDTOOQFC6EB4CGQOFN4QO5JTJVSXBLEDSOMETHING"),
      { wrapper },
    );

    await waitFor(() => expect(result.current.error).toBeDefined());
    expect(result.current.solver).toBeUndefined();
  });

  it("returns solver with chains when available", async () => {
    const solverWithChains: Solver = {
      ...mockSolver,
      chains: ["ethereum", "polygon", "base", "arbitrum"],
    };

    (fetch as ReturnType<typeof vi.fn>).mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => solverWithChains,
    });

    const { result } = renderHook(
      () =>
        useSolver("GBRPYHIL2CI3WHZDTOOQFC6EB4CGQOFN4QO5JTJVSXBLEDSOMETHING"),
      { wrapper },
    );

    await waitFor(() => expect(result.current.solver).toBeDefined());
    expect(result.current.solver!.chains).toEqual([
      "ethereum",
      "polygon",
      "base",
      "arbitrum",
    ]);
  });

  it("returns an inactive solver correctly", async () => {
    const inactiveSolver: Solver = {
      ...mockSolver,
      status: "inactive",
      fills: 0,
    };

    (fetch as ReturnType<typeof vi.fn>).mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => inactiveSolver,
    });

    const { result } = renderHook(
      () =>
        useSolver("GBRPYHIL2CI3WHZDTOOQFC6EB4CGQOFN4QO5JTJVSXBLEDSOMETHING"),
      { wrapper },
    );

    await waitFor(() => expect(result.current.solver).toBeDefined());
    expect(result.current.solver!.status).toBe("inactive");
    expect(result.current.solver!.fills).toBe(0);
  });

  it("does not fetch when address changes from a valid address to null", async () => {
    (fetch as ReturnType<typeof vi.fn>).mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => mockSolver,
    });

    const { result, rerender } = renderHook(
      ({ address }: { address: string | null }) => useSolver(address),
      { wrapper, initialProps: { address: "GBRPYHIL2CI3WHZDTOOQFC6EB4CGQOFN4QO5JTJVSXBLEDSOMETHING" as string | null } }
    );

    await waitFor(() => expect(result.current.solver).toBeDefined());

    // Re-render with null — SWR stops fetching
    rerender({ address: null });
    expect(result.current.isLoading).toBe(false);
  });
});
