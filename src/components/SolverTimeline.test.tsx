import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { SolverTimeline } from "./SolverTimeline";
import type { FeedItem } from "@/lib/types";

const SOLVER_ADDR = "GBRPYHIL2CI3WHZDTOOQFC6EB4CGQOFN4QO5JTJVSXBLEDSOMETHING";
const OTHER_ADDR = "GDIFFERENTADDRESS000000000000000000000000000000000000000";

// ── Helpers ────────────────────────────────────────────────────────────────

function makeFill(overrides: Partial<FeedItem> = {}): FeedItem {
  return {
    id: `fill-${Math.random()}`,
    srcChain: "ethereum",
    srcToken: "USDC",
    srcAmount: "100",
    dstToken: "XLM",
    solver: SOLVER_ADDR,
    status: "filled",
    createdAt: new Date().toISOString(),
    ...overrides,
  };
}

function makeWeeklyFills(count: number): FeedItem[] {
  return Array.from({ length: count }, (_, i) =>
    makeFill({
      id: `fill-${i}`,
      // Space fills ~1 week apart so they land in distinct weekly buckets.
      createdAt: new Date(Date.now() - i * 7 * 24 * 60 * 60 * 1000).toISOString(),
    })
  );
}

// ── Tests ──────────────────────────────────────────────────────────────────

describe("SolverTimeline", () => {
  it("shows a loading skeleton when isLoading is true", () => {
    const { container } = render(
      <SolverTimeline solverAddress={SOLVER_ADDR} fills={[]} isLoading />
    );
    expect(container.querySelectorAll(".animate-pulse").length).toBeGreaterThan(0);
    // The full timeline content should not be present.
    expect(screen.queryByText("Solver Timeline")).not.toBeInTheDocument();
  });

  it("renders the 'just getting started' empty state when there are no fills", () => {
    render(
      <SolverTimeline solverAddress={SOLVER_ADDR} fills={[]} />
    );
    expect(screen.getByText("Solver Timeline")).toBeInTheDocument();
    expect(screen.getByText("Just getting started")).toBeInTheDocument();
    expect(screen.getByText(/hasn't filled any intents yet/)).toBeInTheDocument();
  });

  it("ignores fills from other solvers in empty-state calculation", () => {
    const fills = [makeFill({ solver: OTHER_ADDR })];
    render(
      <SolverTimeline solverAddress={SOLVER_ADDR} fills={fills} />
    );
    // Should still show empty state because no fills belong to SOLVER_ADDR.
    expect(screen.getByText("Just getting started")).toBeInTheDocument();
  });

  it("renders sparse state with a single fill without a sparkline polyline", () => {
    const fills = [makeFill()];
    render(
      <SolverTimeline solverAddress={SOLVER_ADDR} fills={fills} />
    );
    expect(screen.getByText("Solver Timeline")).toBeInTheDocument();
    // Sparse fallback text instead of a chart.
    expect(screen.getByText(/chart will populate as more data arrives/)).toBeInTheDocument();
    // Should NOT render an SVG sparkline for sparse data.
    expect(document.querySelector("polyline")).not.toBeInTheDocument();
  });

  it("shows a first-fill milestone for sparse data", () => {
    const fills = [makeFill({ createdAt: "2025-03-10T12:00:00Z" })];
    render(
      <SolverTimeline solverAddress={SOLVER_ADDR} fills={fills} />
    );
    expect(screen.getByText("First fill")).toBeInTheDocument();
  });

  it("renders the SVG sparkline for rich data (2+ weekly buckets)", () => {
    const fills = makeWeeklyFills(4);
    render(
      <SolverTimeline solverAddress={SOLVER_ADDR} fills={fills} />
    );
    // The polyline element should exist when there are multiple weekly buckets.
    // (It's aria-hidden but still in the DOM.)
    const polylines = document.querySelectorAll("polyline");
    expect(polylines.length).toBeGreaterThan(0);
  });

  it("provides a screen-reader accessible text summary for rich data", () => {
    const fills = makeWeeklyFills(4);
    render(
      <SolverTimeline solverAddress={SOLVER_ADDR} fills={fills} />
    );
    // The sr-only paragraph should contain a meaningful summary.
    const srParagraph = document.querySelector(".sr-only");
    expect(srParagraph).toBeTruthy();
    expect(srParagraph?.textContent).toMatch(/fill/i);
  });

  it("shows the 5-fills milestone when solver has >= 5 fills", () => {
    const fills = makeWeeklyFills(5);
    render(
      <SolverTimeline solverAddress={SOLVER_ADDR} fills={fills} />
    );
    expect(screen.getByText("5 fills milestone")).toBeInTheDocument();
  });

  it("does not show the 5-fills milestone for fewer than 5 fills", () => {
    const fills = makeWeeklyFills(3);
    render(
      <SolverTimeline solverAddress={SOLVER_ADDR} fills={fills} />
    );
    expect(screen.queryByText("5 fills milestone")).not.toBeInTheDocument();
  });

  it("shows the 10-fills milestone when solver has >= 10 fills", () => {
    const fills = makeWeeklyFills(10);
    render(
      <SolverTimeline solverAddress={SOLVER_ADDR} fills={fills} />
    );
    expect(screen.getByText("10 fills milestone")).toBeInTheDocument();
  });

  it("displays correct summary stats", () => {
    const fills = [
      makeFill({ status: "filled" }),
      makeFill({ status: "filled" }),
      makeFill({ status: "failed" }),
    ];
    render(
      <SolverTimeline solverAddress={SOLVER_ADDR} fills={fills} />
    );
    expect(screen.getByText("3")).toBeInTheDocument(); // Total fills
    expect(screen.getByText("2")).toBeInTheDocument(); // Successful
    expect(screen.getByText("67%")).toBeInTheDocument(); // 2/3 rounded
  });

  it("shows a 'most recent fill' milestone when there are multiple fills", () => {
    const fills = [
      makeFill({ id: "old", createdAt: "2025-01-01T00:00:00Z" }),
      makeFill({ id: "new", createdAt: "2025-06-15T00:00:00Z" }),
    ];
    render(
      <SolverTimeline solverAddress={SOLVER_ADDR} fills={fills} />
    );
    expect(screen.getByText("Most recent fill")).toBeInTheDocument();
  });

  it("only counts fills belonging to the target solver address", () => {
    const fills = [
      makeFill({ solver: SOLVER_ADDR, status: "filled" }),
      makeFill({ solver: OTHER_ADDR, status: "filled" }),
      makeFill({ solver: OTHER_ADDR, status: "filled" }),
    ];
    render(
      <SolverTimeline solverAddress={SOLVER_ADDR} fills={fills} />
    );
    // Only 1 fill belongs to SOLVER_ADDR — should show "1" in Total fills.
    const statCells = screen.getAllByText("1");
    expect(statCells.length).toBeGreaterThan(0);
  });
});
