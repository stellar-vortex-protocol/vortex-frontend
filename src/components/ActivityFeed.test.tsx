import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import type { FeedItem } from "@/lib/types";

const { useIntentFeedMock } = vi.hoisted(() => ({ useIntentFeedMock: vi.fn() }));
vi.mock("@/hooks/useIntentFeed", () => ({ useIntentFeed: useIntentFeedMock }));

import { ActivityFeed } from "./ActivityFeed";

const item: FeedItem = {
  id: "1",
  srcChain: "ethereum",
  srcToken: "USDC",
  srcAmount: "500",
  dstToken: "USDC",
  solver: "Alpha",
  status: "filled",
  createdAt: new Date(Date.now() - 12_000).toISOString(),
};

describe("ActivityFeed", () => {
  it("renders a loading skeleton while the initial snapshot is in flight", () => {
    useIntentFeedMock.mockReturnValue({ items: [], isLoading: true, isLive: false });
    const { container } = render(<ActivityFeed />);
    expect(container.querySelectorAll(".animate-pulse")).toHaveLength(3);
  });

  it("renders feed items and a Live indicator once the socket is open", () => {
    useIntentFeedMock.mockReturnValue({ items: [item], isLoading: false, isLive: true });
    render(<ActivityFeed />);

    expect(screen.getByText("Live")).toBeInTheDocument();
    expect(screen.getByText("500 USDC → USDC")).toBeInTheDocument();
    expect(screen.getByText(/ethereum · via Alpha/)).toBeInTheDocument();
  });

  it("shows a Polling indicator when the socket is not open", () => {
    useIntentFeedMock.mockReturnValue({ items: [item], isLoading: false, isLive: false });
    render(<ActivityFeed />);

    expect(screen.getByText("Polling")).toBeInTheDocument();
  });
});
