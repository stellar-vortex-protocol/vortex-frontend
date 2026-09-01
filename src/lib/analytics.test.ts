import { describe, expect, it } from "vitest";
import type { FeedItem } from "@/lib/types";
import { computeAnalytics } from "./analytics";

const baseItems: FeedItem[] = [
  {
    id: "i-1",
    srcChain: "ethereum",
    srcToken: "USDC",
    srcAmount: "1000",
    dstToken: "XLM",
    solver: "solver-a",
    status: "filled",
    createdAt: "2025-01-01T00:00:00Z",
  },
  {
    id: "i-2",
    srcChain: "base",
    srcToken: "WETH",
    srcAmount: "0.5",
    dstToken: "USDC",
    solver: "solver-b",
    status: "pending",
    createdAt: "2025-01-02T00:00:00Z",
  },
  {
    id: "i-3",
    srcChain: "ethereum",
    srcToken: "USDC",
    srcAmount: "2500",
    dstToken: "XLM",
    solver: "solver-a",
    status: "failed",
    createdAt: "2025-01-02T12:00:00Z",
  },
  {
    id: "i-4",
    srcChain: "polygon",
    srcToken: "MATIC",
    srcAmount: "100",
    dstToken: "USDC",
    solver: "solver-c",
    status: "accepted",
    createdAt: "2025-01-03T00:00:00Z",
  },
];

describe("computeAnalytics", () => {
  it("totals volume and status counts across the feed", () => {
    const analytics = computeAnalytics(baseItems);

    expect(analytics.totalIntents).toBe(4);
    expect(analytics.totalVolumeUsd).toBeCloseTo(1000 + 0.5 * 3512.8 + 2500 + 100 * 0.58, 5);
    expect(analytics.statusCounts.pending).toBe(1);
    expect(analytics.statusCounts.accepted).toBe(1);
    expect(analytics.statusCounts.filled).toBe(1);
    expect(analytics.statusCounts.failed).toBe(1);
  });

  it("groups chain volume and destination token volume sensibly", () => {
    const analytics = computeAnalytics(baseItems);

    expect(analytics.chainBreakdown[0]!.label).toBe("ethereum");
    expect(analytics.chainBreakdown[0]!.value).toBeCloseTo(3500, 5);

    expect(analytics.destinationTokenBreakdown.map((entry) => entry.label)).toContain("USDC");
    expect(analytics.destinationTokenBreakdown.map((entry) => entry.label)).toContain("XLM");
    expect(analytics.destinationTokenBreakdown[0]!.value).toBeGreaterThan(0);
  });

  it("builds route rankings and a time series from the intent timestamps", () => {
    const analytics = computeAnalytics(baseItems);

    expect(analytics.routeBreakdown[0]!.sourceChain).toBe("ethereum");
    expect(analytics.routeBreakdown[0]!.destinationToken).toBe("XLM");
    expect(analytics.volumeOverTime.length).toBeGreaterThan(0);
    expect(analytics.volumeOverTime[0]!.totalVolumeUsd).toBeGreaterThanOrEqual(0);
  });
});
