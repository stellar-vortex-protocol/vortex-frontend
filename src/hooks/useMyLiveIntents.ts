import { useEffect, useState } from "react";
import { useMyIntents } from "./useMyIntents";
import { useWebSocket } from "./useWebSocket";
import type { FeedItem } from "@/lib/types";

const MAX_ITEMS = 200;
const WS_URL = process.env["NEXT_PUBLIC_WS_URL"] ?? null;

function mergeById(items: FeedItem[]): FeedItem[] {
  const seen = new Set<string>();
  const merged: FeedItem[] = [];
  for (const item of items) {
    if (seen.has(item.id)) continue;
    seen.add(item.id);
    merged.push(item);
  }
  return merged.slice(0, MAX_ITEMS);
}

export function useMyLiveIntents(address: string | null) {
  const { intents: restIntents, isLoading, error, mutate } = useMyIntents(address);
  const { status, lastMessage } = useWebSocket<FeedItem>(address ? WS_URL : null);
  const [liveItems, setLiveItems] = useState<FeedItem[]>([]);

  useEffect(() => {
    if (!lastMessage) return;
    setLiveItems((prev) => mergeById([lastMessage, ...prev]));
  }, [lastMessage]);

  return {
    intents: mergeById([...liveItems, ...restIntents]),
    isLoading,
    error,
    mutate,
    isLive: status === "open",
  };
}
