import { useEffect, useState } from "react";
import { useIntents } from "./useIntents";
import { useWebSocket } from "./useWebSocket";
import type { FeedItem } from "@/lib/types";

const MAX_ITEMS = 200;
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

// Like useIntentFeed, but sized for the full explore browse view rather
// than the homepage's small preview list.
export function useLiveIntents() {
  const { intents: restIntents, isLoading, error } = useIntents();
  const { status, lastMessage } = useWebSocket<FeedItem>(WS_URL);
  const [liveItems, setLiveItems] = useState<FeedItem[]>([]);

  useEffect(() => {
    if (!lastMessage) return;
    setLiveItems((prev) => mergeById([lastMessage, ...prev]));
  }, [lastMessage]);

  return {
    intents: mergeById([...liveItems, ...restIntents]),
    isLoading,
    error,
    isLive: status === "open",
  };
}
