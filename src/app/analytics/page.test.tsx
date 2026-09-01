import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi, beforeEach } from "vitest";

const { useLiveIntentsMock } = vi.hoisted(() => ({
  useLiveIntentsMock: vi.fn(),
}));

vi.mock("@/hooks/useLiveIntents", () => ({
  useLiveIntents: useLiveIntentsMock,
}));

import AnalyticsPage from "./page";

describe("AnalyticsPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders the loading state while analytics are fetching", () => {
    useLiveIntentsMock.mockReturnValue({ intents: [], isLoading: true, error: undefined, isLive: false });

    render(<AnalyticsPage />);

    expect(screen.getByText("Loading analytics…")).toBeInTheDocument();
  });

  it("renders the empty state when there are no intents", () => {
    useLiveIntentsMock.mockReturnValue({ intents: [], isLoading: false, error: undefined, isLive: false });

    render(<AnalyticsPage />);

    expect(screen.getByText("No tracked intents yet")).toBeInTheDocument();
  });

  it("renders the protocol analytics when data is available", () => {
    useLiveIntentsMock.mockReturnValue({
      intents: [
        {
          id: "1",
          srcChain: "ethereum",
          srcToken: "USDC",
          srcAmount: "1000",
          dstToken: "XLM",
          solver: "solver-a",
          status: "filled",
          createdAt: "2025-01-01T00:00:00Z",
        },
      ],
      isLoading: false,
      error: undefined,
      isLive: true,
    });

    render(<AnalyticsPage />);

    expect(screen.getByRole("heading", { name: /protocol analytics/i })).toBeInTheDocument();
    expect(screen.getByText(/Based on the last 200 tracked intents/i)).toBeInTheDocument();
    expect(screen.getByText("Filled")).toBeInTheDocument();
  });
});
