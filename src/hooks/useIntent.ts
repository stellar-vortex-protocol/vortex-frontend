import useSWR from "swr";
import { fetcher } from "@/lib/api";
import type { IntentDetail } from "@/lib/types";

export function useIntent(id: string | null) {
  const { data, error, isLoading } = useSWR<IntentDetail>(id ? `/intents/${id}` : null, fetcher);

  return { intent: data, isLoading, error };
}
