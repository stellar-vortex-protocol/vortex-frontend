import type { FeedItem } from "@/lib/types";
import type { NotifiableStatus, NotificationPreferences } from "@/store/notificationPreferences";

export type NotificationPermissionState = NotificationPermission | "unsupported";

export type DispatchContext = {
  prefs: NotificationPreferences;
  status: FeedItem["status"];
  visible: boolean;
  isLeader: boolean;
  permission: NotificationPermissionState;
  now: Date;
};

export type ChannelDecision = { toast: boolean; browser: boolean; sound: boolean };

const NONE: ChannelDecision = { toast: false, browser: false, sound: false };

function toMinutes(hhmm: string): number | null {
  const m = /^(\d{2}):(\d{2})$/.exec(hhmm);
  return m ? Number(m[1]) * 60 + Number(m[2]) : null;
}

export function isQuietHours(start: string, end: string, now: Date): boolean {
  const s = toMinutes(start);
  const e = toMinutes(end);
  if (s === null || e === null || s === e) return false;
  const cur = now.getHours() * 60 + now.getMinutes();
  // Ranges may wrap past midnight (e.g. 22:00-07:00).
  return s < e ? cur >= s && cur < e : cur >= s || cur < e;
}

/**
 * Pure channel decision. Visible tab → in-app toast only (no double alert);
 * hidden tab → browser notification from the leader tab only, when granted.
 */
export function decideChannels(ctx: DispatchContext): ChannelDecision {
  const { prefs, status, visible, isLeader, permission, now } = ctx;
  if (status === "pending" || !prefs.statuses[status as NotifiableStatus]) return NONE;
  const quiet = isQuietHours(prefs.quietStart, prefs.quietEnd, now);

  if (visible) {
    return { toast: prefs.channels.toast, browser: false, sound: prefs.channels.sound && !quiet };
  }
  const browser = prefs.channels.browser && permission === "granted" && isLeader && !quiet;
  return {
    // Toasts still queue in hidden tabs so they're seen on return, unless a
    // browser notification already covered it.
    toast: prefs.channels.toast && !browser,
    browser,
    sound: false,
  };
}

/** Notification copy. Amounts/tokens only appear when the user opted into details. */
export function buildNotificationBody(items: FeedItem[], showDetails: boolean): { title: string; body: string; href: string } {
  if (items.length > 1) {
    return { title: "Vortex", body: `${items.length} of your intents updated`, href: "/my-intents" };
  }
  const item = items[0] as FeedItem;
  const body = showDetails
    ? `${item.srcAmount} ${item.srcToken} → ${item.dstToken} is now ${item.status}`
    : `Intent ${item.id.slice(0, 8)} is now ${item.status}`;
  return { title: "Vortex", body, href: `/explore/${item.id}` };
}
