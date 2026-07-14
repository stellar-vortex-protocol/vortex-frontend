import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import type { Solver } from "@/lib/types";

const { useSolversMock } = vi.hoisted(() => ({ useSolversMock: vi.fn() }));
vi.mock("@/hooks/useSolvers", () => ({ useSolvers: useSolversMock }));

import SolvePage from "./page";

const solvers: Solver[] = [
  {
    name: "Alpha Market Making",
    address: "GABC...1234",
    bondUsd: 5000,
    fills: 842,
    failed: 3,
    volumeUsd: 4_200_000,
    avgFillTimeSeconds: 47,
    successRatePct: 99.6,
    chains: ["Ethereum", "Base"],
    status: "active",
  },
];

describe("SolvePage leaderboard", () => {
  it("shows a loading skeleton while solvers are being fetched", () => {
    useSolversMock.mockReturnValue({ solvers: [], isLoading: true, error: undefined });
    const { container } = render(<SolvePage />);
    expect(container.querySelectorAll(".animate-pulse").length).toBeGreaterThan(0);
  });

  it("shows an error state when the leaderboard fails to load", () => {
    useSolversMock.mockReturnValue({ solvers: [], isLoading: false, error: new Error("boom") });
    render(<SolvePage />);
    expect(screen.getByText(/Couldn't load the solver leaderboard/)).toBeInTheDocument();
  });

  it("shows an empty state when there are no active solvers", () => {
    useSolversMock.mockReturnValue({ solvers: [], isLoading: false, error: undefined });
    render(<SolvePage />);
    expect(screen.getByText("No active solvers yet.")).toBeInTheDocument();
  });

  it("renders solver rows with formatted volume and rates", () => {
    useSolversMock.mockReturnValue({ solvers, isLoading: false, error: undefined });
    render(<SolvePage />);

    expect(screen.getByText("Alpha Market Making")).toBeInTheDocument();
    expect(screen.getByText("842")).toBeInTheDocument();
    expect(screen.getByText("$4.2M")).toBeInTheDocument();
    expect(screen.getByText("47s")).toBeInTheDocument();
    expect(screen.getByText("99.6%")).toBeInTheDocument();
  });
});
