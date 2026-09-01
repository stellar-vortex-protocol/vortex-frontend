import { describe, it, expect, vi } from "vitest";
import { renderHook } from "@testing-library/react";
import { useSolverVerification } from "./useSolverVerification";
import * as useSolversModule from "./useSolvers";
import type { Solver } from "@/lib/types";

const mockSolvers: Solver[] = [
  {
    name: "AlphaMax",
    address: "GBRPYHIL2CI3WHZDTOOQFC6EB4CGQOFN4QO5JTJVSXBLEDSOMETHING",
    bondUsd: 500,
    fills: 42,
    failed: 1,
    volumeUsd: 125000,
    avgFillTimeSeconds: 12,
    successRatePct: 97.67,
    chains: ["ethereum", "polygon"],
    status: "active",
  },
];

describe("useSolverVerification", () => {
  it("should provide solver verification utilities", () => {
    vi.spyOn(useSolversModule, "useSolvers").mockReturnValue({
      solvers: mockSolvers,
      isLoading: false,
      error: null,
    } as any);

    const { result } = renderHook(() => useSolverVerification());

    expect(result.current.solvers).toEqual(mockSolvers);
    expect(result.current.isLoading).toBe(false);
    expect(result.current.error).toBeNull();
  });

  it("should verify solver addresses", () => {
    vi.spyOn(useSolversModule, "useSolvers").mockReturnValue({
      solvers: mockSolvers,
      isLoading: false,
      error: null,
    } as any);

    const { result } = renderHook(() => useSolverVerification());

    const verification = result.current.verifySolver(
      "GBRPYHIL2CI3WHZDTOOQFC6EB4CGQOFN4QO5JTJVSXBLEDSOMETHING"
    );

    expect(verification.isVerified).toBe(true);
    expect(verification.solver?.name).toBe("AlphaMax");
  });

  it("should detect unverified solver addresses", () => {
    vi.spyOn(useSolversModule, "useSolvers").mockReturnValue({
      solvers: mockSolvers,
      isLoading: false,
      error: null,
    } as any);

    const { result } = renderHook(() => useSolverVerification());

    const verification = result.current.verifySolver(
      "GBUNKNOWNADDRESS0000000000000000000000000000000000000000"
    );

    expect(verification.isVerified).toBe(false);
    expect(verification.warning).toBe("Unverified solver identifier");
  });

  it("should format solver identifiers correctly", () => {
    vi.spyOn(useSolversModule, "useSolvers").mockReturnValue({
      solvers: mockSolvers,
      isLoading: false,
      error: null,
    } as any);

    const { result } = renderHook(() => useSolverVerification());

    const formatted = result.current.formatIdentifier(
      "GBRPYHIL2CI3WHZDTOOQFC6EB4CGQOFN4QO5JTJVSXBLEDSOMETHING"
    );

    expect(formatted).toBe("AlphaMax");
  });

  it("should provide display name with verification status", () => {
    vi.spyOn(useSolversModule, "useSolvers").mockReturnValue({
      solvers: mockSolvers,
      isLoading: false,
      error: null,
    } as any);

    const { result } = renderHook(() => useSolverVerification());

    const displayName = result.current.getDisplayName(
      "GBRPYHIL2CI3WHZDTOOQFC6EB4CGQOFN4QO5JTJVSXBLEDSOMETHING"
    );

    expect(displayName.name).toBe("AlphaMax");
    expect(displayName.isVerified).toBe(true);
  });
});
