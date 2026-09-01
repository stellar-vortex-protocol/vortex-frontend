/**
 * Hook to verify solver identity and detect unverified solver identifiers.
 * Uses useSolvers() to get the list of registered solvers and provides
 * verification utilities for displaying solver information safely.
 */

import { useMemo } from "react";
import { useSolvers } from "./useSolvers";
import { verifySolverAddress, getSolverDisplayName, formatSolverIdentifier } from "@/lib/solverVerification";
import type { VerificationResult } from "@/lib/solverVerification";
import type { Solver } from "@/lib/types";

export interface UseSolverVerificationResult {
  solvers: Solver[];
  isLoading: boolean;
  error: any;
  verifySolver: (address: string | null | undefined) => VerificationResult;
  getDisplayName: (address: string | null | undefined) => { name: string; isVerified: boolean };
  formatIdentifier: (address: string | null | undefined, showAddress?: boolean) => string;
}

export function useSolverVerification(): UseSolverVerificationResult {
  const { solvers, isLoading, error } = useSolvers();

  const verify = useMemo(() => {
    return (address: string | null | undefined) => verifySolverAddress(address, solvers);
  }, [solvers]);

  const getDisplayName = useMemo(() => {
    return (address: string | null | undefined) => getSolverDisplayName(address, solvers);
  }, [solvers]);

  const formatIdentifier = useMemo(() => {
    return (address: string | null | undefined, showAddress: boolean = false) =>
      formatSolverIdentifier(address, solvers, { showAddress });
  }, [solvers]);

  return {
    solvers,
    isLoading,
    error,
    verifySolver: verify,
    getDisplayName,
    formatIdentifier,
  };
}
