import useSWR from "swr";
import { endpoint } from "@/lib/api";
import { solverSchema } from "@/lib/schemas";

const fetcher = endpoint(solverSchema);
import type { Solver } from "@/lib/types";

export function useSolver(address: string | null) {
  const encodedAddress = address ? encodeURIComponent(address) : null;
  const { data, error, isLoading } = useSWR<Solver>(
    encodedAddress ? `/solvers/${encodedAddress}` : null,
    fetcher,
  );

  return { solver: data, isLoading, error };
}
