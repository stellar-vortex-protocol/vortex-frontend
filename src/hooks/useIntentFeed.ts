import { useEffect, useState } from "react";
import { useActivityFeed } from "./useActivityFeed";
import { useWebSocket } from "./useWebSocket";
import type { FeedItem } from "@/lib/types";

const MAX_ITEMS = 8;
const WS_URL = process.env.NEXT_PUBLIC_WS_URL ?? null;

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

// Seeds the feed from the REST snapshot (useActivityFeed) and layers live
// updates from the intents WebSocket on top, newest first, deduped by id.
export function useIntentFeed() {
  const { items: seedItems, isLoading, error } = useActivityFeed();
  const { status, lastMessage } = useWebSocket<FeedItem>(WS_URL);
  const [liveItems, setLiveItems] = useState<FeedItem[]>([]);

  useEffect(() => {
    if (!lastMessage) return;
    setLiveItems((prev) => mergeById([lastMessage, ...prev]));
  }, [lastMessage]);

  return {
    items: mergeById([...liveItems, ...seedItems]),
    isLoading,
    error,
    isLive: status === "open",
  };
}
