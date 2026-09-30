import useSWR from "swr";
import {
  evaluateSolverIdentity,
  type SolverIdentity,
  type VerifySolverResponse,
} from "@/lib/solverIdentity";

async function fetchIdentity(path: string): Promise<VerifySolverResponse> {
  const res = await fetch(path, { headers: { accept: "application/json" } });
  if (!res.ok) throw new Error(`verify-solver ${res.status}`);
  return (await res.json()) as VerifySolverResponse;
}

/**
 * Domain-backed identity for a solver: `verified | unverified | mismatch |
 * unavailable`. Display only — never use this for authorization.
 * The proxy caches for 1 h; SWR dedupes across all badges for the same domain.
 */
export function useSolverIdentity(
  address: string | null | undefined,
  domain: string | null | undefined,
): SolverIdentity & { isLoading: boolean } {
  const key = address && domain ? `/api/verify-solver?domain=${encodeURIComponent(domain)}` : null;
  const { data, error, isLoading } = useSWR<VerifySolverResponse>(key, fetchIdentity, {
    revalidateOnFocus: false,
    dedupingInterval: 60 * 60 * 1000,
    shouldRetryOnError: false,
  });
  return { ...evaluateSolverIdentity(address, domain, data ?? null, Boolean(error)), isLoading };
}
