import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import type { Solver } from "@/lib/types";
import { SolverHeaderCard } from "./SolverHeaderCard";

vi.mock("@/components/IntentStatusBadge", () => ({
  IntentStatusBadge: ({ status }: { status: string }) => (
    <div data-testid="status-badge">{status}</div>
  ),
}));

describe("SolverHeaderCard", () => {
  const mockSolver: Solver = {
    name: "Alpha Market Making",
    address: "GBRPYHIL2CI3WHZDTOOQFC6EB4CGQOFN4QO5JTJVSXBLEDSOMETHING",
    bondUsd: 5000,
    fills: 842,
    failed: 3,
    volumeUsd: 4_200_000,
    avgFillTimeSeconds: 47,
    successRatePct: 99.6,
    chains: ["Ethereum", "Base"],
    status: "active",
  };

  it("renders solver name with proper heading level", () => {
    render(<SolverHeaderCard solver={mockSolver} />);

    const heading = screen.getByRole("heading", { level: 1 });
    expect(heading).toHaveTextContent("Alpha Market Making");
  });

  it("displays solver identity information in header", () => {
    render(<SolverHeaderCard solver={mockSolver} />);

    expect(screen.getByText("Solver")).toBeInTheDocument();
    expect(screen.getByText(/GBRPYHIL.+BLEDSOMETHING/)).toBeInTheDocument();
  });

  it("shows bond amount in USD currency format", () => {
    render(<SolverHeaderCard solver={mockSolver} />);

    expect(screen.getByText("Bond")).toBeInTheDocument();
    expect(screen.getByText("$5K")).toBeInTheDocument();
  });

  it("displays status badge with active styling for active solvers", () => {
    render(<SolverHeaderCard solver={mockSolver} />);

    const statusBadge = screen.getByLabelText(/Solver status:/);
    expect(statusBadge).toHaveTextContent("Active");
    expect(statusBadge).toHaveClass("bg-vx-sage-bg");
    expect(statusBadge).toHaveClass("text-vx-sage");
  });

  it("displays status badge with inactive styling for inactive solvers", () => {
    const inactiveSolver: Solver = {
      ...mockSolver,
      status: "inactive",
    };

    render(<SolverHeaderCard solver={inactiveSolver} />);

    const statusBadge = screen.getByLabelText(/Solver status:/);
    expect(statusBadge).toHaveTextContent("Inactive");
    expect(statusBadge).toHaveClass("bg-vx-surface");
    expect(statusBadge).toHaveClass("text-vx-muted");
  });

  it("shows bond in separate status card", () => {
    render(<SolverHeaderCard solver={mockSolver} />);

    const statusCard = screen.getByText("Status").closest(".bg-vx-surface\\/40");
    expect(statusCard).toBeInTheDocument();
    expect(statusCard).toHaveTextContent("active");
  });

  it("truncates long addresses for display", () => {
    const longAddressSolver: Solver = {
      ...mockSolver,
      address: "GBRPYHIL2CI3WHZDTOOQFC6EB4CGQOFN4QO5JTJVSXBLEDSOMETHINGEXTENSION",
    };

    render(<SolverHeaderCard solver={longAddressSolver} />);

    const addressDisplay = screen.getByText(/Address:/);
    expect(addressDisplay).toHaveTextContent(/GBRPYH.+EXTENSION/);
  });

  it("applies responsive spacing and sizing", () => {
    const { container } = render(<SolverHeaderCard solver={mockSolver} />);

    const card = container.querySelector(".card");
    expect(card).toHaveClass("p-4");
    expect(card).toHaveClass("sm:p-6");
    expect(card).toHaveClass("space-y-4");
    expect(card).toHaveClass("sm:space-y-6");
  });

  it("renders metrics grid with proper column layout", () => {
    const { container } = render(<SolverHeaderCard solver={mockSolver} />);

    const grid = container.querySelector(".grid");
    expect(grid).toHaveClass("grid-cols-2");
    expect(grid).toHaveClass("gap-3");
    expect(grid).toHaveClass("sm:gap-4");
  });

  it("displays bond and status metrics in card layout", () => {
    const { container } = render(<SolverHeaderCard solver={mockSolver} />);

    const metricCards = container.querySelectorAll(".bg-vx-surface\\/40");
    expect(metricCards.length).toBeGreaterThanOrEqual(2);
  });

  it("uses correct ARIA labels for accessibility", () => {
    render(<SolverHeaderCard solver={mockSolver} />);

    const statusBadge = screen.getByLabelText(/Solver status:/);
    expect(statusBadge).toBeInTheDocument();
  });

  it("formats bond as compact currency for large amounts", () => {
    const richSolver: Solver = {
      ...mockSolver,
      bondUsd: 1_000_000,
    };

    render(<SolverHeaderCard solver={richSolver} />);

    expect(screen.getByText("$1M")).toBeInTheDocument();
  });

  it("handles short solver names without word breaking issues", () => {
    const shortNameSolver: Solver = {
      ...mockSolver,
      name: "Bot",
    };

    render(<SolverHeaderCard solver={shortNameSolver} />);

    const heading = screen.getByRole("heading", { level: 1 });
    expect(heading).toHaveTextContent("Bot");
  });

  it("handles very long solver names with word breaking", () => {
    const longNameSolver: Solver = {
      ...mockSolver,
      name: "A Very Long Solver Name That Should Wrap On Smaller Screens",
    };

    const { container } = render(<SolverHeaderCard solver={longNameSolver} />);

    const heading = container.querySelector("h1");
    expect(heading).toHaveClass("break-words");
  });
});
