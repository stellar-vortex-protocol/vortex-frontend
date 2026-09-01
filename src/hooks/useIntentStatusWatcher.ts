import { useEffect, useRef } from "react";
import { usePathname } from "next/navigation";
import { useWebSocket } from "./useWebSocket";
import { useToastStore } from "@/store/toast";
import type { FeedItem } from "@/lib/types";

const WS_URL = process.env.NEXT_PUBLIC_WS_URL ?? null;
const BATCH_WINDOW_MS = 1000;

// Lighter-weight than useMyLiveIntents: it only observes the WebSocket feed to
// diff status transitions, skipping the REST snapshot fetch, since this hook
// is mounted app-wide (see IntentStatusWatcher in src/app/layout.tsx) rather
// than page-scoped. As with useMyIntents, the backend doesn't yet expose a
// per-address filter, so (like the rest of the app) this watches the shared
// feed rather than a truly user-scoped one.
export function useIntentStatusWatcher(address: string | null) {
  const { lastMessage } = useWebSocket<FeedItem>(address ? WS_URL : null);
  const addToast = useToastStore((s) => s.addToast);
  const pathname = usePathname();

  const statusesRef = useRef<Map<string, FeedItem["status"]>>(new Map());
  const pendingRef = useRef<FeedItem[]>([]);
  const flushTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Reset tracked state on wallet disconnect/switch so stale transitions
  // don't fire toasts for a different (or no) wallet.
  useEffect(() => {
    statusesRef.current = new Map();
    pendingRef.current = [];
    if (flushTimerRef.current) {
      clearTimeout(flushTimerRef.current);
      flushTimerRef.current = null;
    }
  }, [address]);

  useEffect(() => {
    if (!lastMessage || !address) return;

    const previous = statusesRef.current.get(lastMessage.id);
    statusesRef.current.set(lastMessage.id, lastMessage.status);
    if (previous === undefined || previous === lastMessage.status) return;

    // Someone already looking at /my-intents sees the transition live; avoid
    // a redundant toast on top of that view.
    if (pathname === "/my-intents") return;

    pendingRef.current.push(lastMessage);
    if (flushTimerRef.current) return;

    flushTimerRef.current = setTimeout(() => {
      const batch = pendingRef.current;
      pendingRef.current = [];
      flushTimerRef.current = null;

      if (batch.length === 1) {
        const item = batch[0];
        addToast(
          `${item.srcAmount} ${item.srcToken} → ${item.dstToken} is now ${item.status}`,
          item.status === "failed" ? "error" : "success",
          `/explore/${item.id}`,
        );
      } else {
        addToast(`${batch.length} of your intents updated`, "info", "/my-intents");
      }
    }, BATCH_WINDOW_MS);
  }, [lastMessage, address, pathname, addToast]);
}
