import useSWR from "swr";
import { fetcher } from "@/lib/api";
import type { Solver } from "@/lib/types";

export function useSolver(address: string | null) {
  const encodedAddress = address ? encodeURIComponent(address) : null;
  const { data, error, isLoading } = useSWR<Solver>(
    encodedAddress ? `/solvers/${encodedAddress}` : null,
    fetcher,
  );

  return { solver: data, isLoading, error };
}
