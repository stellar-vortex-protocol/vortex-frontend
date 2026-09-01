import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

const { useIntentFeedMock } = vi.hoisted(() => ({ useIntentFeedMock: vi.fn() }));
vi.mock("@/hooks/useIntentFeed", () => ({ useIntentFeed: useIntentFeedMock }));
// The swap card has its own suite; stub it so this one stays about the page shell.
vi.mock("@/components/SwapCard", () => ({ SwapCard: () => <div data-testid="swap-card" /> }));
// Nav/Footer/ActivityFeed carry their own (currently broken on main) suites and
// wallet/i18n context this one doesn't set up.
vi.mock("@/components/Nav", () => ({ Nav: () => null }));
vi.mock("@/components/Footer", () => ({ Footer: () => null }));
vi.mock("@/components/ActivityFeed", () => ({ ActivityFeed: () => <div data-testid="activity-feed" /> }));

import HomePage from "./page";

function renderHome() {
  useIntentFeedMock.mockReturnValue({ items: [], isLoading: false, isLive: true });
  return render(<HomePage />);
}

describe("HomePage", () => {
  beforeEach(() => {
    // Suppress the first-visit onboarding sequence for the shell tests.
    localStorage.setItem("vortex-onboarding-seen", "1");
  });

  it("renders content within a main landmark", () => {
    renderHome();
    expect(screen.getByRole("main")).toHaveAttribute("id", "main-content");
  });

  it("renders the hero copy in the default locale", () => {
    renderHome();

    expect(screen.getByText("Stellar Agentic Hackathon 2025")).toBeInTheDocument();

    // The headline keeps its two-line, two-colour markup, so assert each line.
    const heading = screen.getByRole("heading", { level: 1 });
    expect(heading).toHaveTextContent("Swap from any chain");
    expect(heading).toHaveTextContent("directly to Stellar.");

    expect(screen.getByText(/Vortex is an intent-based cross-chain protocol\./)).toBeInTheDocument();
  });

  it("labels the stat tiles and keeps their values", () => {
    renderHome();

    expect(screen.getByText("Total Volume")).toBeInTheDocument();
    expect(screen.getByText("$4.2M")).toBeInTheDocument();
    expect(screen.getByText("Intents Filled")).toBeInTheDocument();
    expect(screen.getByText("2,270")).toBeInTheDocument();
    expect(screen.getByText("Active Solvers")).toBeInTheDocument();
    expect(screen.getByText("Avg Fill Time")).toBeInTheDocument();
    expect(screen.getByText("42s")).toBeInTheDocument();
  });

  it("renders every intent pipeline stage", () => {
    renderHome();

    for (const [label, sub] of [
      ["Intent", "You submit"],
      ["Auction", "Solvers bid"],
      ["Relay", "Best fills"],
      ["Settle", "On Stellar"],
    ] as [string, string][]) {
      expect(screen.getByText(label)).toBeInTheDocument();
      expect(screen.getByText(sub)).toBeInTheDocument();
    }
  });

  it("links the live feed through to the explore page", () => {
    renderHome();

    expect(screen.getByText("Live Fills")).toBeInTheDocument();
    expect(screen.getByText("View all →")).toHaveAttribute("href", "/explore");
  });

  it("lists the supported chains alongside the Stellar destination", () => {
    renderHome();

    expect(screen.getByText("Supported chains")).toBeInTheDocument();
    expect(screen.getByText("Stellar (dest.)")).toBeInTheDocument();
  });

  it("shows the first-visit onboarding without blocking access to the swap card", async () => {
    localStorage.removeItem("vortex-onboarding-seen");
    renderHome();

    expect(screen.getByRole("dialog", { name: "Start a swap here" })).toBeInTheDocument();
    // The swap card is still rendered and reachable behind the hint.
    expect(screen.getByTestId("swap-card")).toBeInTheDocument();

    await userEvent.click(screen.getByRole("button", { name: "Skip" }));
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });
});
