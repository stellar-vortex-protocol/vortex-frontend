import useSWR from "swr";
import { endpoint } from "@/lib/api";
import { solverSchema } from "@/lib/schemas";

const fetcher = endpoint(solverSchema);
import type { Solver } from "@/lib/types";

export function useSolver(address: string | null) {
  const { data, error, isLoading } = useSWR<Solver>(
    address ? `/solvers/${address}` : null,
    fetcher,
  );

  return { solver: data, isLoading, error };
}
