import useSWR from "swr";
import { fetcher } from "@/lib/api";
import type { FeedItem } from "@/lib/types";

export function useActivityFeed() {
  const { data, error, isLoading } = useSWR<FeedItem[]>("/intents/feed", fetcher, {
    refreshInterval: 8000,
  });

  return { items: data ?? [], isLoading, error };
}
