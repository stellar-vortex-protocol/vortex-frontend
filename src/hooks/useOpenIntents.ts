import useSWR from "swr";
import { fetcher } from "@/lib/api";
import type { OpenIntent } from "@/lib/types";

export function useOpenIntents() {
  const { data, error, isLoading } = useSWR<OpenIntent[]>("/intents/open", fetcher, {
    refreshInterval: 5000,
  });

  return { intents: data ?? [], isLoading, error };
}
