import useSWR from "swr";
import { fetcher } from "@/lib/api";
import type { Solver } from "@/lib/types";

export function useSolver(address: string | null) {
  const { data, error, isLoading } = useSWR<Solver>(
    address ? `/solvers/${address}` : null,
    fetcher,
  );

  return { solver: data, isLoading, error };
}
