import type { Solver } from "./types";

/**
 * Concrete effect of changing the minimum solver bond, simulated against the
 * current solver set. Kept pure (no fetching, no rendering) so it can be
 * tested against fixtures.
 */
export type BondThresholdImpact = {
  direction: "raise" | "lower" | "unchanged";
  proposedValue: number;
  /** Solvers in the data set. */
  total: number;
  /** Solvers whose bond meets the proposed minimum. */
  qualifyAfter: number;
  /** Solvers that meet the current minimum but not the proposed one. */
  wouldLose: number;
  /** Solvers below the current minimum that the proposed one would admit. */
  wouldGain: number;
};

export function simulateBondThreshold(
  solvers: readonly Pick<Solver, "bondUsd">[],
  currentValue: number,
  proposedValue: number,
): BondThresholdImpact {
  const meets = (bond: number, threshold: number) => bond >= threshold;
  let qualifyAfter = 0;
  let wouldLose = 0;
  let wouldGain = 0;
  for (const { bondUsd } of solvers) {
    const now = meets(bondUsd, currentValue);
    const after = meets(bondUsd, proposedValue);
    if (after) qualifyAfter += 1;
    if (now && !after) wouldLose += 1;
    if (!now && after) wouldGain += 1;
  }
  return {
    direction:
      proposedValue > currentValue ? "raise" : proposedValue < currentValue ? "lower" : "unchanged",
    proposedValue,
    total: solvers.length,
    qualifyAfter,
    wouldLose,
    wouldGain,
  };
}
