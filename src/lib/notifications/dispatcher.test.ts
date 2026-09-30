import { describe, expect, it } from "vitest";
import { DEFAULT_NOTIFICATION_PREFERENCES as D } from "@/store/notificationPreferences";
import type { FeedItem } from "@/lib/types";
import { buildNotificationBody, decideChannels, isQuietHours, type DispatchContext } from "./dispatcher";

const noon = new Date(2026, 0, 1, 12, 0);
const base: DispatchContext = {
  prefs: { ...D, channels: { toast: true, browser: true, sound: true } },
  status: "filled",
  visible: true,
  isLeader: true,
  permission: "granted",
  now: noon,
};

describe("decideChannels", () => {
  it.each([
    ["visible tab → toast + sound, no browser", {}, { toast: true, browser: false, sound: true }],
    ["hidden leader tab → browser only", { visible: false }, { toast: false, browser: true, sound: false }],
    ["hidden non-leader → toast fallback", { visible: false, isLeader: false }, { toast: true, browser: false, sound: false }],
    ["permission denied → toast fallback", { visible: false, permission: "denied" as const }, { toast: true, browser: false, sound: false }],
    ["unsupported → toast fallback", { visible: false, permission: "unsupported" as const }, { toast: true, browser: false, sound: false }],
    ["pending never notifies", { status: "pending" as const }, { toast: false, browser: false, sound: false }],
    [
      "disabled status never notifies",
      { prefs: { ...base.prefs, statuses: { ...D.statuses, filled: false } } },
      { toast: false, browser: false, sound: false },
    ],
    [
      "quiet hours mute sound and browser",
      { visible: false, prefs: { ...base.prefs, quietStart: "11:00", quietEnd: "13:00" } },
      { toast: true, browser: false, sound: false },
    ],
  ])("%s", (_name, over, expected) => {
    expect(decideChannels({ ...base, ...over })).toEqual(expected);
  });
});

describe("isQuietHours", () => {
  it("handles same-day and overnight ranges", () => {
    expect(isQuietHours("11:00", "13:00", noon)).toBe(true);
    expect(isQuietHours("22:00", "07:00", new Date(2026, 0, 1, 23, 30))).toBe(true);
    expect(isQuietHours("22:00", "07:00", noon)).toBe(false);
    expect(isQuietHours("", "07:00", noon)).toBe(false);
    expect(isQuietHours("10:00", "10:00", noon)).toBe(false);
  });
});

describe("buildNotificationBody", () => {
  const item = { id: "abcdef1234", srcAmount: "5", srcToken: "USDC", dstToken: "XLM", status: "filled" } as FeedItem;

  it("hides amounts unless details are enabled", () => {
    expect(buildNotificationBody([item], false).body).toBe("Intent abcdef12 is now filled");
    expect(buildNotificationBody([item], true).body).toContain("5 USDC");
    expect(buildNotificationBody([item], false).href).toBe("/explore/abcdef1234");
  });

  it("summarises batches", () => {
    expect(buildNotificationBody([item, item], true)).toMatchObject({ href: "/my-intents", body: "2 of your intents updated" });
  });
});
