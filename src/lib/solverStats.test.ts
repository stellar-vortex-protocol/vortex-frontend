import { describe, expect, it } from "vitest";
import {
  compareHref,
  compareSolvers,
  computeCoverage,
  computeSolverStats,
  coverageOverlap,
  estimateEarnings,
  filterByStatus,
  groupByWeek,
  isoWeekKey,
  isoWeekStart,
  parseCompareParams,
  parseDecimal,
  formatDecimal,
} from "./solverStats";
import type { FeedItem, Solver } from "./types";

const A = "GDR4FJGZFDFHXGDM66DLF4GNMNKR4BF7BFAKEA6URFRHWAPLFL3REFRB";
const B = "GBIQWBNH6YITCT3UI7WAQIXH2SOZHXNTY34Q4TBMZU3ZYMFIV6DDYQ6O";
const C = "GC5AF5XNCOCZ32HQWFTKZIICUVZYMEUP3JFRO4YPDQK45DXKMFJFQT24";

function fill(overrides: Partial<FeedItem>): FeedItem {
  return {
    id: Math.random().toString(36),
    srcChain: "ethereum",
    srcToken: "USDC",
    srcAmount: "100",
    dstToken: "XLM",
    solver: A,
    status: "filled",
    createdAt: "2025-06-10T12:00:00Z",
    ...overrides,
  };
}

function solver(overrides: Partial<Solver>): Solver {
  return {
    name: "S",
    address: A,
    bondUsd: 100,
    fills: 10,
    failed: 0,
    volumeUsd: 1000,
    avgFillTimeSeconds: 10,
    successRatePct: 99,
    chains: ["ethereum"],
    status: "active",
    ...overrides,
  };
}

describe("isoWeekKey", () => {
  it.each([
    ["2020-12-31T12:00:00Z", "2020-W53"],
    ["2021-01-01T00:00:00Z", "2020-W53"],
    ["2021-01-04T00:00:00Z", "2021-W01"],
    ["2024-12-30T00:00:00Z", "2025-W01"],
    ["2026-01-01T23:59:59Z", "2026-W01"],
    ["2027-01-03T23:59:59Z", "2026-W53"],
    ["2025-03-30T01:30:00Z", "2025-W13"], // EU DST switch day
  ])("%s → %s", (iso, expected) => {
    expect(isoWeekKey(new Date(iso))).toBe(expected);
  });

  it("round-trips through isoWeekStart to a UTC Monday", () => {
    const start = isoWeekStart("2025-W01");
    expect(start.toISOString()).toBe("2024-12-30T00:00:00.000Z");
    expect(isoWeekKey(start)).toBe("2025-W01");
  });
});

describe("groupByWeek", () => {
  it("groups across a year boundary and skips invalid dates", () => {
    const result = groupByWeek([
      { createdAt: "2024-12-31T10:00:00Z" },
      { createdAt: "2025-01-02T10:00:00Z" },
      { createdAt: "2024-12-20T10:00:00Z" },
      { createdAt: "not-a-date" },
    ]);
    expect(result).toEqual([
      { week: "2024-W51", count: 1 },
      { week: "2025-W01", count: 2 },
    ]);
  });
});

describe("computeSolverStats", () => {
  const now = Date.parse("2025-06-10T18:00:00Z");

  it("flags insufficient data below 5 fills", () => {
    const stats = computeSolverStats([fill({})], 7, now);
    expect(stats.insufficientData).toBe(true);
    expect(stats.series).toHaveLength(7);
  });

  it("computes totals, success rate and zero-filled buckets", () => {
    const fills = [
      ...Array.from({ length: 4 }, () => fill({})),
      fill({ status: "failed", createdAt: "2025-06-08T00:00:00Z" }),
      fill({ createdAt: "2025-05-01T00:00:00Z" }), // outside window
    ];
    const stats = computeSolverStats(fills, 7, now);
    expect(stats.total).toBe(5);
    expect(stats.successRatePct).toBe(80);
    expect(stats.insufficientData).toBe(false);
    expect(stats.series.at(-1)).toMatchObject({ start: "2025-06-10", fills: 4 });
    expect(stats.series.filter((b) => b.fills === 0)).toHaveLength(5);
    expect(stats.series[0]!.successRatePct).toBeNull();
  });

  it("uses weekly buckets for 90 days", () => {
    expect(computeSolverStats([], 90, now).series).toHaveLength(13);
  });
});

describe("coverage and filters", () => {
  it("builds a chain × token matrix with the latest fill", () => {
    const cells = computeCoverage([
      fill({ createdAt: "2025-01-01T00:00:00Z" }),
      fill({ createdAt: "2025-02-01T00:00:00Z" }),
      fill({ srcChain: "base", dstToken: "USDC" }),
    ]);
    expect(cells).toEqual([
      { chain: "base", token: "USDC", count: 1, lastFillAt: "2025-06-10T12:00:00Z" },
      { chain: "ethereum", token: "XLM", count: 2, lastFillAt: "2025-02-01T00:00:00Z" },
    ]);
  });

  it("filters by status", () => {
    const items = [fill({}), fill({ status: "failed" })];
    expect(filterByStatus(items, "all")).toHaveLength(2);
    expect(filterByStatus(items, "failed")).toHaveLength(1);
  });
});

describe("compareSolvers", () => {
  it("marks best and worst with direction awareness", () => {
    const r = compareSolvers([
      solver({ avgFillTimeSeconds: 5, fills: 1 }),
      solver({ avgFillTimeSeconds: 20, fills: 3 }),
      solver({ avgFillTimeSeconds: 10, fills: 3 }),
    ]);
    expect(r.avgFillTimeSeconds).toEqual({ best: [0], worst: [1] });
    expect(r.fills).toEqual({ best: [1, 2], worst: [0] });
  });

  it("marks nothing for equal values or missing solvers", () => {
    const r = compareSolvers([solver({}), null, solver({})]);
    expect(r.bondUsd).toEqual({ best: [], worst: [] });
    expect(compareSolvers([solver({}), null]).fills).toEqual({ best: [], worst: [] });
  });

  it("computes coverage overlap", () => {
    expect(
      coverageOverlap([solver({ chains: ["a", "b"] }), null, solver({ chains: ["b", "c"] })]),
    ).toEqual(["b"]);
    expect(coverageOverlap([null])).toEqual([]);
  });
});

describe("parseCompareParams", () => {
  it("validates, dedupes and caps addresses", () => {
    const r = parseCompareParams([A, A.toLowerCase(), "bogus", null, B, C]);
    expect(r.addresses).toEqual([A, B, C]);
    expect(r.invalid).toEqual(["bogus"]);
  });

  it("builds a shareable href", () => {
    expect(compareHref([A, B])).toBe(`/solve/compare?a=${A}&b=${B}`);
  });
});

describe("earnings", () => {
  it("parses and formats fixed-point decimals", () => {
    expect(parseDecimal("1.5")).toBe(BigInt(15_000_000));
    expect(parseDecimal("abc")).toBeNull();
    expect(formatDecimal(BigInt(15_000_000))).toBe("1.5");
    expect(formatDecimal(BigInt(20_000_000))).toBe("2");
  });

  it("sums fees for filled intents per token without precision loss", () => {
    const r = estimateEarnings([
      fill({ srcAmount: "123456789012345678.5" }),
      fill({ srcAmount: "1000", status: "failed" }),
      fill({ srcToken: "EURC", srcAmount: "50" }),
      fill({ srcAmount: "bad" }),
    ]);
    expect(r).toEqual([
      { token: "EURC", amount: "0.05" },
      { token: "USDC", amount: "123456789012345.6785" },
    ]);
  });
});
