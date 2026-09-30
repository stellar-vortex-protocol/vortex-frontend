import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import type { FeedItem } from "@/lib/types";
import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import type { FeedItem } from "@/lib/types";

const useIntentFeedMock = vi.hoisted(() => vi.fn());
vi.mock("@/hooks/useIntentFeed", () => ({ useIntentFeed: useIntentFeedMock }));
vi.mock("@/lib/i18n/I18nProvider", () => ({
  useTranslation: () => ({
    t: (k: string) => {
      const map: Record<string, string> = {
        "solverDetail.fillHistory.empty.title": "No fills yet",
        "solverDetail.fillHistory.empty.message":
          "Once this solver starts accepting and filling intents, their history will appear here.",
      };
      return map[k] ?? k;
    },
  }),
}));

vi.mock("@/components/IntentStatusBadge", () => ({
  IntentStatusBadge: ({ status }: { status: string }) => (
    <div data-testid="status-badge">{status}</div>
  ),
}));

vi.mock("@/lib/time", () => ({
  timeAgo: (date: string) => {
    const now = new Date();
    const then = new Date(date);
    const seconds = Math.floor((now.getTime() - then.getTime()) / 1000);

    if (seconds < 60) return `${seconds}s ago`;
    if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
    if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
    return `${Math.floor(seconds / 86400)}d ago`;
  },
}));

import { SolverFillHistory } from "./SolverFillHistory";

const SOLVER_ADDRESS = "GBRPYHIL2CI3WHZDTOOQFC6EB4CGQOFN4QO5JTJVSXBLEDSOMETHING";
const OTHER_ADDRESS = "GDIFFERENTSOLVERADDRESS000000000000000000000000000000000";

const makeFill = (overrides: Partial<FeedItem> = {}): FeedItem => ({
  id: "fill-1",
  srcChain: "ethereum",
  srcToken: "USDC",
  srcAmount: "500",
  dstToken: "XLM",
  solver: SOLVER_ADDRESS,
  status: "filled",
  createdAt: new Date(Date.now() - 60_000).toISOString(),
  ...overrides,
});

describe("SolverFillHistory", () => {
  it("shows a loading skeleton while fetching", () => {
    useIntentFeedMock.mockReturnValue({
      items: [],
      isLoading: true,
      error: undefined,
      isLive: false,
    });

    const { container } = render(
      <SolverFillHistory solverAddress="GBRPYHIL2CI3WHZDTOOQFC6EB4CGQOFN4QO5JTJVSXBLEDSOMETHING" />
    );

    expect(container.querySelectorAll(".animate-pulse").length).toBeGreaterThan(0);
  });

  it("shows error state when fill history fails to load", () => {
    useIntentFeedMock.mockReturnValue({
      items: 
    useIntentFeedMock.mockReturnValue({
      items: [],
      isLoading: true,
      error: undefined,
    useIntentFeedMock.mockReturnValue({
      items: [],
      isLoading: true,
      error: undefined,
      isLive: false,
    });

    const { container } = render(
      <SolverFillHistory solverAddress="GBRPYHIL2CI3WHZDTOOQFC6EB4CGQOFN4QO5JTJVSXBLEDSOMETHING" />
    );

    expect(container.querySelectorAll(".animate-pulse").length).toBeGreaterThan(0);
  });

  it("shows error state when fill history fails to load", () => {
    useIntentFeedMock.mockReturnValue({
      items: [],
      isLoading: false,
      error: new Error("Failed to fetch"),
      isLive: false,
    });

    render(
      <SolverFillHistory solverAddress="GBRPYHIL2CI3WHZDTOOQFC6EB4CGQOFN4QO5JTJVSXBLEDSOMETHING" />
    );

    expect(screen.getByRole("alert")).toBeInTheDocument();
    expect(screen.getByText(/Couldn't load fill history/)).toBeInTheDocument();
  });

  it("shows empty state when solver has no fills", () => {
    useIntentFeedMock.mockReturnValue({
      items: [
        {
          id: "fill-1",
          srcChain: "ethereum",
          srcToken: "USDC",
          srcAmount: "500",
          dstToken: "USDT",
          solver: "DIFFERENT_ADDRESS",
          status: "filled" as const,
          createdAt: new Date().toISOString(),
        },
      ],
      isLoading: false,
      error: undefined,
      isLive: false,
    });

    render(
      <SolverFillHistory solverAddress="GBRPYHIL2CI3WHZDTOOQFC6EB4CGQOFN4QO5JTJVSXBLEDSOMETHING" />
    );

    expect(screen.getByText(/No fills from this solver/)).toBeInTheDocument();
  });

  it("renders fills with proper formatting and status badges", () => {
    const fills: FeedItem[] = [
      {
        id: "fill-1",
        srcChain: "ethereum",
        srcToken: "USDC",
        srcAmount: "500",
        dstToken: "USDT",
        solver: "GBRPYHIL2CI3WHZDTOOQFC6EB4CGQOFN4QO5JTJVSXBLEDSOMETHING",
        status: "filled",
        createdAt: new Date().toISOString(),
      },
      {
        id: "fill-2",
        srcChain: "polygon",
        srcToken: "DAI",
        srcAmount: "1000",
        dstToken: "USDC",
        solver: "GBRPYHIL2CI3WHZDTOOQFC6EB4CGQOFN4QO5JTJVSXBLEDSOMETHING",
        status: "pending",
        createdAt: new Date(Date.now() - 300000).toISOString(),
      },
    ];

    useIntentFeedMock.mockReturnValue({
      items: fills,
      isLoading: false,
      error: undefined,
      isLive: false,
    });

    render(
      <SolverFillHistory solverAddress="GBRPYHIL2CI3WHZDTOOQFC6EB4CGQOFN4QO5JTJVSXBLEDSOMETHING" />
    );

    expect(screen.getByText("500 USDC → USDT")).toBeInTheDocument();
    expect(screen.getByText("1000 DAI → USDC")).toBeInTheDocument();
    expect(screen.getByText("ethereum")).toBeInTheDocument();
    expect(screen.getByText("polygon")).toBeInTheDocument();
    expect(screen.getAllByTestId("status-badge")).toHaveLength(2);
  });

  it("shows at most 10 fills even when more are available", () => {
    const fills: FeedItem[] = Array.from({ length: 15 }, (_, i) => ({
      id: `fill-${i}`,
      srcChain: "ethereum",
      srcToken: "USDC",
      srcAmount: "100",
      dstToken: "USDT",
      solver: "GBRPYHIL2CI3WHZDTOOQFC6EB4CGQOFN4QO5JTJVSXBLEDSOMETHING",
      status: "filled" as const,
      createdAt: new Date(Date.now() - i * 60000).toISOString(),
    }));

    useIntentFeedMock.mockReturnValue({
      items: fills,
      isLoading: false,
      error: undefined,
      isLive: false,
    });

    render(
      <SolverFillHistory solverAddress="GBRPYHIL2CI3WHZDTOOQFC6EB4CGQOFN4QO5JTJVSXBLEDSOMETHING" />
    );

    const fills_display = screen.getAllByText("100 USDC → USDT");
    expect(fills_display.length).toBeLessThanOrEqual(10);
  });

  it("filters fills by solver address correctly", () => {
    const fills: FeedItem[] = [
      {
        id: "fill-1",
        srcChain: "ethereum",
        srcToken: "USDC",
        srcAmount: "500",
        dstToken: "USDT",
        solver: "GBRPYHIL2CI3WHZDTOOQFC6EB4CGQOFN4QO5JTJVSXBLEDSOMETHING",
        status: "filled",
        createdAt: new Date().toISOString(),
      },
      {
        id: "fill-2",
        srcChain: "polygon",
        srcToken: "DAI",
        srcAmount: "1000",
        dstToken: "USDC",
        solver: "DIFFERENT_ADDRESS",
        status: "pending",
        createdAt: new Date().toISOString(),
      },
    ];

    useIntentFeedMock.mockReturnValue({
      items: fills,
      isLoading: false,
      error: undefined,
      isLive: false,
    });

    render(
      <SolverFillHistory solverAddress="GBRPYHIL2CI3WHZDTOOQFC6EB4CGQOFN4QO5JTJVSXBLEDSOMETHING" />
    );

    expect(screen.getByText("500 USDC → USDT")).toBeInTheDocument();
    expect(screen.queryByText("1000 DAI → USDC")).not.toBeInTheDocument();
  });
});
