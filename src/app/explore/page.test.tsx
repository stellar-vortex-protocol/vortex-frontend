import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { FeedItem } from "@/lib/types";

const { useIntentsMock } = vi.hoisted(() => ({ useIntentsMock: vi.fn() }));
vi.mock("@/hooks/useIntents", () => ({ useIntents: useIntentsMock }));

import ExplorePage from "./page";

const intents: FeedItem[] = [
  {
    id: "1",
    srcChain: "ethereum",
    srcToken: "USDC",
    srcAmount: "500",
    dstToken: "USDC",
    solver: "Alpha",
    status: "filled",
    createdAt: "2026-07-14T00:00:00Z",
  },
  {
    id: "2",
    srcChain: "base",
    srcToken: "WETH",
    srcAmount: "0.14",
    dstToken: "USDC",
    solver: "Beta",
    status: "pending",
    createdAt: "2026-07-14T00:05:00Z",
  },
];

describe("ExplorePage", () => {
  it("shows a loading skeleton before the first fetch resolves", () => {
    useIntentsMock.mockReturnValue({ intents: [], isLoading: true, error: undefined });
    const { container } = render(<ExplorePage />);
    expect(container.querySelectorAll(".animate-pulse").length).toBeGreaterThan(0);
  });

  it("shows an empty state when there are no intents", () => {
    useIntentsMock.mockReturnValue({ intents: [], isLoading: false, error: undefined });
    render(<ExplorePage />);
    expect(screen.getByText("No intents match your filters.")).toBeInTheDocument();
  });

  it("shows an error state when the fetch fails", () => {
    useIntentsMock.mockReturnValue({ intents: [], isLoading: false, error: new Error("boom") });
    render(<ExplorePage />);
    expect(screen.getByText(/Couldn't load intents/)).toBeInTheDocument();
  });

  it("renders all intents by default", () => {
    useIntentsMock.mockReturnValue({ intents, isLoading: false, error: undefined });
    render(<ExplorePage />);
    expect(screen.getByText("500 USDC → USDC")).toBeInTheDocument();
    expect(screen.getByText("0.14 WETH → USDC")).toBeInTheDocument();
    expect(screen.getByText("2 intents")).toBeInTheDocument();
  });

  it("filters by status", async () => {
    useIntentsMock.mockReturnValue({ intents, isLoading: false, error: undefined });
    const user = userEvent.setup();
    render(<ExplorePage />);

    await user.selectOptions(screen.getByDisplayValue("All statuses"), "pending");

    expect(screen.getByText("0.14 WETH → USDC")).toBeInTheDocument();
    expect(screen.queryByText("500 USDC → USDC")).not.toBeInTheDocument();
    expect(screen.getByText("1 intent")).toBeInTheDocument();
  });

  it("filters by chain", async () => {
    useIntentsMock.mockReturnValue({ intents, isLoading: false, error: undefined });
    const user = userEvent.setup();
    render(<ExplorePage />);

    await user.selectOptions(screen.getByDisplayValue("All chains"), "base");

    expect(screen.getByText("0.14 WETH → USDC")).toBeInTheDocument();
    expect(screen.queryByText("500 USDC → USDC")).not.toBeInTheDocument();
  });

  it("links each row to its intent detail page", () => {
    useIntentsMock.mockReturnValue({ intents, isLoading: false, error: undefined });
    render(<ExplorePage />);

    expect(screen.getByText("500 USDC → USDC").closest("a")).toHaveAttribute("href", "/explore/1");
  });
});
