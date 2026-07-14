import useSWR from "swr";
import { fetcher } from "@/lib/api";
import type { Solver } from "@/lib/types";

export function useSolvers() {
  const { data, error, isLoading } = useSWR<Solver[]>("/solvers", fetcher);

  return { solvers: data ?? [], isLoading, error };
}
