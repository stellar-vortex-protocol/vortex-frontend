import { useEffect, useRef } from "react";
import { usePathname } from "next/navigation";
import { useWebSocket } from "./useWebSocket";
import { useToastStore } from "@/store/toast";
import { useNotificationPreferences } from "@/store/notificationPreferences";
import { buildNotificationBody, decideChannels, type NotificationPermissionState } from "@/lib/notifications/dispatcher";
import { createLeaderElection } from "@/lib/notifications/leader";
import type { FeedItem } from "@/lib/types";

const WS_URL = process.env.NEXT_PUBLIC_WS_URL ?? null;

function currentPermission(): NotificationPermissionState {
  return typeof Notification === "undefined" ? "unsupported" : Notification.permission;
}

function playChime() {
  try {
    const ctx = new AudioContext();
    const osc = ctx.createOscillator();
    osc.frequency.value = 880;
    osc.connect(ctx.destination);
    osc.start();
    osc.stop(ctx.currentTime + 0.12);
    osc.onended = () => void ctx.close();
  } catch {
    // Audio unavailable/blocked before a user gesture - sound is best-effort.
  }
}

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
  const leaderRef = useRef<ReturnType<typeof createLeaderElection> | null>(null);

  useEffect(() => {
    leaderRef.current = createLeaderElection();
    return () => {
      leaderRef.current?.close();
      leaderRef.current = null;
    };
  }, []);

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

    const prefs = useNotificationPreferences.getState();
    flushTimerRef.current = setTimeout(() => {
      const current = useNotificationPreferences.getState();
      const ctx = {
        prefs: current,
        visible: document.visibilityState === "visible",
        isLeader: leaderRef.current?.isLeader() ?? true,
        permission: currentPermission(),
        now: new Date(),
      };
      const batch = pendingRef.current.filter((item) => {
        const d = decideChannels({ ...ctx, status: item.status });
        return d.toast || d.browser || d.sound;
      });
      pendingRef.current = [];
      flushTimerRef.current = null;
      if (batch.length === 0) return;

      // One decision per batch, taken from the "loudest" status in it.
      const decision = batch
        .map((item) => decideChannels({ ...ctx, status: item.status }))
        .reduce((acc, d) => ({ toast: acc.toast || d.toast, browser: acc.browser || d.browser, sound: acc.sound || d.sound }));

      if (decision.toast) {
        if (batch.length === 1) {
          const item = batch[0]!;
          addToast(
            `${item.srcAmount} ${item.srcToken} → ${item.dstToken} is now ${item.status}`,
            item.status === "failed" ? "error" : "success",
            `/explore/${item.id}`,
          );
        } else {
          addToast(`${batch.length} of your intents updated`, "info", "/my-intents");
        }
      }
      if (decision.browser) {
        const { title, body, href } = buildNotificationBody(batch, current.showDetails);
        const n = new Notification(title, { body, tag: href });
        n.onclick = () => {
          window.focus();
          window.location.assign(href);
        };
      }
      if (decision.sound) playChime();
    }, prefs.batchWindowMs);
  }, [lastMessage, address, pathname, addToast]);
}
