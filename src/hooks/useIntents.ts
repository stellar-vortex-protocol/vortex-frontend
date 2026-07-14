import useSWR from "swr";
import { fetcher } from "@/lib/api";
import type { FeedItem } from "@/lib/types";

export function useIntents() {
  const { data, error, isLoading } = useSWR<FeedItem[]>("/intents", fetcher);

  return { intents: data ?? [], isLoading, error };
}
