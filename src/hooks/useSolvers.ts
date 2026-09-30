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
