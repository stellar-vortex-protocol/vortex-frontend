import { describe, expect, it } from "vitest";
import { simulateBondThreshold } from "./governanceImpact";

const solvers = [{ bondUsd: 60 }, { bondUsd: 100 }, { bondUsd: 250 }];

describe("simulateBondThreshold", () => {
  it("counts solvers that would stop qualifying when the bond is raised", () => {
    expect(simulateBondThreshold(solvers, 50, 200)).toEqual({
      direction: "raise",
      proposedValue: 200,
      total: 3,
      qualifyAfter: 1,
      wouldLose: 2,
      wouldGain: 0,
    });
  });

  it("treats a bond exactly at the new minimum as qualifying", () => {
    expect(simulateBondThreshold(solvers, 50, 100).wouldLose).toBe(1);
  });

  it("reports no losses when every solver already meets a raised minimum", () => {
    const impact = simulateBondThreshold(solvers, 50, 60);
    expect(impact.wouldLose).toBe(0);
    expect(impact.qualifyAfter).toBe(3);
  });

  it("describes a lowered bond as easier to qualify for", () => {
    const impact = simulateBondThreshold([{ bondUsd: 40 }, { bondUsd: 120 }], 100, 30);
    expect(impact.direction).toBe("lower");
    expect(impact.wouldLose).toBe(0);
    expect(impact.wouldGain).toBe(1);
    expect(impact.qualifyAfter).toBe(2);
  });

  it("handles an unchanged value and an empty solver set", () => {
    expect(simulateBondThreshold(solvers, 50, 50).direction).toBe("unchanged");
    expect(simulateBondThreshold([], 50, 200)).toMatchObject({ total: 0, qualifyAfter: 0, wouldLose: 0 });
  });
});
