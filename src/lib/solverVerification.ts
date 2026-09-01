/**
 * Solver identity verification utilities.
 * Defends against solver impersonation by cross-referencing displayed solver
 * identifiers against registered solvers from useSolvers().
 */

import type { Solver } from "@/lib/types";

export interface VerificationResult {
  isVerified: boolean;
  solver?: Solver;
  warning?: string;
}

/**
 * Verify that a solver address exists in the registered solvers list.
 * Accounts for race conditions where newly-registered solvers may not yet
 * appear in cached responses.
 */
export function verifySolverAddress(
  solverAddress: string | null | undefined,
  registeredSolvers: Solver[]
): VerificationResult {
  if (!solverAddress) {
    return { isVerified: false, warning: "No solver specified" };
  }

  const solver = registeredSolvers.find(s => s.address === solverAddress);

  if (!solver) {
    return {
      isVerified: false,
      warning: "Unverified solver identifier",
    };
  }

  return { isVerified: true, solver };
}

/**
 * Get a display name for a solver, with verification status.
 * Returns the solver's registered name if verified, or the address if unverified.
 */
export function getSolverDisplayName(
  solverAddress: string | null | undefined,
  registeredSolvers: Solver[]
): { name: string; isVerified: boolean } {
  const verification = verifySolverAddress(solverAddress, registeredSolvers);

  if (verification.isVerified && verification.solver) {
    return { name: verification.solver.name, isVerified: true };
  }

  return { name: solverAddress || "Unknown", isVerified: false };
}

/**
 * Format a solver identifier for display, including verification status.
 * Used in quote panels, detail pages, and activity feeds.
 */
export function formatSolverIdentifier(
  solverAddress: string | null | undefined,
  registeredSolvers: Solver[],
  options: { showAddress?: boolean } = {}
): string {
  const { name, isVerified } = getSolverDisplayName(solverAddress, registeredSolvers);

  if (isVerified) {
    return name;
  }

  if (options.showAddress && solverAddress) {
    return `${name} (Unverified)`;
  }

  return "Unverified solver identifier";
}
