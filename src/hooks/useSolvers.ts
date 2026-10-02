import useSWR from "swr";
import { endpoint } from "@/lib/api";
import { solverListSchema } from "@/lib/schemas";

const fetcher = endpoint(solverListSchema);
import type { Solver } from "@/lib/types";
import type { TimeWindow } from "@/lib/solverRanking";

// The solver list has no WebSocket coverage; it changes slowly (new
// registrations, bond updates) rather than second-by-second. A 30 s poll
// keeps the leaderboard reasonably fresh without hammering the relay.
//
// dedupingInterval matches refreshInterval to prevent duplicate requests
// on rapid re-mounts within the same 30 s window.
//
// Data source for time windows: `GET /solvers?window=24h|7d|30d` returns
// metrics aggregated over that window (and optionally `previousRank`);
// "all" uses the unscoped `/solvers` list.
export function useSolvers(window: TimeWindow = "all") {
  const key = window === "all" ? "/solvers" : `/solvers?window=${window}`;
  const { data, error, isLoading } = useSWR<Solver[]>(key, fetcher, {
    refreshInterval: 30_000,
    dedupingInterval: 30_000,
  });

  return { solvers: data ?? [], isLoading, error };
}

// The directory needs the full solver set (including inactive solvers) so it
// can offer an "inactive solvers" toggle and build the chain-capability
// matrix without re-fetching per filter change. `includeInactive` is passed
// through to the relay; the response is cached under a distinct key so the
// leaderboard's active-only list is not polluted.
export function useSolverDirectory(includeInactive = false) {
  const key = includeInactive ? "/solvers?includeInactive=true" : "/solvers";
  const { data, error, isLoading } = useSWR<Solver[]>(key, fetcher, {
    refreshInterval: 30_000,
    dedupingInterval: 30_000,
  });

  return { solvers: data ?? [], isLoading, error };
}
