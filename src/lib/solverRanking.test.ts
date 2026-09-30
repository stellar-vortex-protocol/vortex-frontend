import { beforeEach, describe, expect, it } from "vitest";
import {
  filterSolvers,
  parseSorts,
  rankSolvers,
  serializeSorts,
  sortRankedSolvers,
  successRate,
  toggleSort,
  updateRankSnapshot,
  DEFAULT_LEADERBOARD_FILTERS,
  LEADERBOARD_SORT_KEYS,
  type LeaderboardSortKey,
  type SortSpec,
} from "./solverRanking";
import type { Solver } from "./types";

const solver = (over: Partial<Solver>): Solver => ({
  name: "s",
  address: "GA",
  bondUsd: 100,
  fills: 10,
  failed: 0,
  volumeUsd: 1000,
  avgFillTimeSeconds: 10,
  successRatePct: 100,
  chains: ["ethereum"],
  status: "active",
  ...over,
});

describe("successRate", () => {
  it.each([
    [{ fills: 0, failed: 0 }, 0],
    [{ fills: 9, failed: 1 }, 90],
    [{ fills: 5, failed: 0 }, 100],
  ])("%o → %d", (input, expected) => {
    expect(successRate(input)).toBe(expected);
  });
});

describe("rankSolvers", () => {
  it("ranks by volume, then fills, then success, then fill time, then address", () => {
    const ranked = rankSolvers([
      solver({ address: "GD", volumeUsd: 10 }),
      solver({ address: "GC", volumeUsd: 500, fills: 3 }),
      solver({ address: "GB", volumeUsd: 500, fills: 3 }),
      solver({ address: "GA", volumeUsd: 500, fills: 5 }),
      solver({ address: "GE", volumeUsd: 500, fills: 3, avgFillTimeSeconds: 1 }),
    ]);
    expect(ranked.map((s) => [s.address, s.rank])).toEqual([
      ["GA", 1],
      ["GE", 2],
      ["GB", 3],
      ["GC", 4],
      ["GD", 5],
    ]);
  });

  it("computes deltas from relay previousRank, falling back to the local snapshot", () => {
    const ranked = rankSolvers(
      [solver({ address: "GA", volumeUsd: 2, previousRank: 3 }), solver({ address: "GB", volumeUsd: 1 }), solver({ address: "GC", volumeUsd: 0 })],
      { GB: 1 },
    );
    expect(ranked.map((s) => s.rankDelta)).toEqual([2, -1, null]);
  });

  it("does not divide by zero for solvers without fills", () => {
    const [row] = rankSolvers([solver({ fills: 0, failed: 0 })]);
    expect(row?.successRate).toBe(0);
  });
});

describe("sorting", () => {
  const rows = rankSolvers([
    solver({ address: "GA", name: "beta", fills: 1, volumeUsd: 3 }),
    solver({ address: "GB", name: "Alpha", fills: 1, volumeUsd: 2 }),
    solver({ address: "GC", name: "gamma", fills: 2, volumeUsd: 1 }),
  ]);

  it("sorts by several keys and keeps rank as the stable tiebreaker", () => {
    const sorted = sortRankedSolvers(rows, [{ key: "fills", dir: "asc" }, { key: "name", dir: "asc" }]);
    expect(sorted.map((s) => s.address)).toEqual(["GB", "GA", "GC"]);
    expect(sortRankedSolvers(rows, []).map((s) => s.rank)).toEqual([1, 2, 3]);
  });

  it("toggles single and multi sort", () => {
    let s: SortSpec<LeaderboardSortKey>[] = toggleSort<LeaderboardSortKey>([], "fills", false);
    expect(s).toEqual([{ key: "fills", dir: "asc" }]);
    s = toggleSort(s, "fills", false);
    expect(s).toEqual([{ key: "fills", dir: "desc" }]);
    s = toggleSort(s, "name", true);
    expect(s).toEqual([{ key: "fills", dir: "desc" }, { key: "name", dir: "asc" }]);
    s = toggleSort(s, "name", true);
    s = toggleSort(s, "name", true);
    expect(s).toEqual([{ key: "fills", dir: "desc" }]);
    expect(toggleSort(s, "fills", false)).toEqual([]);
  });

  it("round-trips sorts through the URL and ignores junk", () => {
    const specs = [{ key: "fills", dir: "desc" }, { key: "bondUsd", dir: "asc" }] as const;
    expect(parseSorts(serializeSorts(specs), LEADERBOARD_SORT_KEYS)).toEqual(specs);
    expect(parseSorts("evil:asc,fills:up,fills:asc,fills:desc", LEADERBOARD_SORT_KEYS)).toEqual([{ key: "fills", dir: "asc" }]);
  });
});

describe("filterSolvers", () => {
  const list = [
    solver({ address: "GA", chains: ["base"], status: "inactive", bondUsd: 10 }),
    solver({ address: "GB", chains: ["ethereum"], verified: true, bondUsd: 500 }),
  ];
  it("applies chain, status, min bond and verified filters", () => {
    expect(filterSolvers(list, DEFAULT_LEADERBOARD_FILTERS)).toHaveLength(2);
    expect(filterSolvers(list, { ...DEFAULT_LEADERBOARD_FILTERS, chain: "base" }).map((s) => s.address)).toEqual(["GA"]);
    expect(filterSolvers(list, { ...DEFAULT_LEADERBOARD_FILTERS, status: "active" }).map((s) => s.address)).toEqual(["GB"]);
    expect(filterSolvers(list, { ...DEFAULT_LEADERBOARD_FILTERS, minBond: 100 }).map((s) => s.address)).toEqual(["GB"]);
    expect(filterSolvers(list, { ...DEFAULT_LEADERBOARD_FILTERS, verifiedOnly: true }).map((s) => s.address)).toEqual(["GB"]);
  });
});

describe("updateRankSnapshot", () => {
  beforeEach(() => localStorage.clear());

  it("keeps the ranks from before the latest change", () => {
    expect(updateRankSnapshot("7d", { GA: 1, GB: 2 })).toEqual({});
    expect(updateRankSnapshot("7d", { GA: 1, GB: 2 })).toEqual({});
    expect(updateRankSnapshot("7d", { GA: 2, GB: 1 })).toEqual({ GA: 1, GB: 2 });
    // Same ranks again → previous snapshot is preserved across reloads.
    expect(updateRankSnapshot("7d", { GA: 2, GB: 1 })).toEqual({ GA: 1, GB: 2 });
    // Windows are independent.
    expect(updateRankSnapshot("24h", { GA: 1 })).toEqual({});
  });

  it("survives corrupt storage", () => {
    localStorage.setItem("vortex:leaderboard-ranks:7d", "{nope");
    expect(updateRankSnapshot("7d", { GA: 1 })).toEqual({});
  });
});
