import { describe, expect, it } from "vitest";
import { activeIntents, bondHealth, expiringSoon, fillCounts, inactiveReasons } from "./solverDashboard";
import type { FeedItem, Solver } from "./types";

const ME = "GDR4FJGZFDFHXGDM66DLF4GNMNKR4BF7BFAKEA6URFRHWAPLFL3REFRB";
const now = Date.parse("2025-06-10T12:00:00Z");

function item(overrides: Partial<FeedItem>): FeedItem {
  return {
    id: Math.random().toString(36),
    srcChain: "ethereum",
    srcToken: "USDC",
    srcAmount: "1",
    dstToken: "XLM",
    solver: ME,
    status: "filled",
    createdAt: "2025-06-10T11:00:00Z",
    ...overrides,
  };
}

describe("solverDashboard", () => {
  it("classifies bond health against the minimum", () => {
    expect(bondHealth(40).level).toBe("critical");
    expect(bondHealth(60).level).toBe("warning");
    expect(bondHealth(500)).toEqual({ ratio: 10, level: "healthy" });
    expect(bondHealth(10, 0).level).toBe("critical");
  });

  it("lists accepted intents for the solver regardless of casing, soonest first", () => {
    const later = item({ id: "late", status: "accepted", deadline: "2025-06-10T13:00:00Z" });
    const sooner = item({ id: "soon", status: "accepted", solver: ME.toLowerCase(), deadline: "2025-06-10T12:03:00Z" });
    const other = item({ status: "accepted", solver: "GOTHER" });
    const result = activeIntents([later, sooner, other, item({})], ME);
    expect(result.map((i) => i.id)).toEqual(["soon", "late"]);
    expect(expiringSoon(result, now).map((i) => i.id)).toEqual(["soon"]);
    expect(expiringSoon([item({})], now)).toEqual([]);
  });

  it("counts fills in 24h / 7d / 30d windows", () => {
    const counts = fillCounts(
      [
        item({}),
        item({ createdAt: "2025-06-05T00:00:00Z" }),
        item({ createdAt: "2025-05-20T00:00:00Z" }),
        item({ status: "failed" }),
      ],
      ME,
      now,
    );
    expect(counts).toEqual({ last24h: 1, last7d: 2, last30d: 3 });
  });

  it("explains why a solver is inactive", () => {
    const s = { status: "inactive", bondUsd: 10 } as Solver;
    expect(inactiveReasons(s)).toEqual(["status", "bondBelowMinimum"]);
    expect(inactiveReasons({ ...s, status: "active", bondUsd: 100 })).toEqual([]);
  });
});
