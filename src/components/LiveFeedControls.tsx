"use client";

import { useEffect, useRef, useState } from "react";
import { useTranslation } from "@/lib/i18n/I18nProvider";

/** Minimum gap between screen-reader announcements of the buffered count. */
const ANNOUNCE_THROTTLE_MS = 5000;

type LiveFeedControlsProps = {
  userPaused: boolean;
  onToggle: () => void;
  pending: number;
  overflow: boolean;
  onFlush: () => void;
  /** Set false when the host feed already owns a polite live region. */
  announce?: boolean;
};

export function LiveFeedControls({ userPaused, onToggle, pending, overflow, onFlush, announce = true }: LiveFeedControlsProps) {
  const { t } = useTranslation();
  const [announcement, setAnnouncement] = useState("");
  const lastAnnounced = useRef(0);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const label = overflow
    ? t("liveFeed.newOverflow", { count: pending })
    : t("liveFeed.new", { count: pending });

  useEffect(() => {
    if (pending === 0) return;
    const wait = Math.max(0, lastAnnounced.current + ANNOUNCE_THROTTLE_MS - Date.now());
    if (timer.current !== null) clearTimeout(timer.current);
    timer.current = setTimeout(() => {
      lastAnnounced.current = Date.now();
      setAnnouncement(label);
    }, wait);
  }, [label, pending]);

  useEffect(() => () => {
    if (timer.current !== null) clearTimeout(timer.current);
  }, []);

  return (
    <div className="flex flex-wrap items-center gap-2">
      <button
        type="button"
        aria-pressed={userPaused}
        onClick={onToggle}
        className="rounded-full border border-vx-line px-2.5 py-1 text-[11px] text-vx-muted hover:text-vx-text focus-visible:outline focus-visible:outline-2 focus-visible:outline-vx-sage"
      >
        {userPaused ? t("liveFeed.paused") : t("liveFeed.live")}
      </button>
      {pending > 0 && (
        <button
          type="button"
          onClick={onFlush}
          className="rounded-full bg-vx-sage-bg px-3 py-1 text-[11px] font-medium text-vx-sage focus-visible:outline focus-visible:outline-2 focus-visible:outline-vx-sage"
        >
          {label}
        </button>
      )}
      {announce && (
        <span role="status" aria-live="polite" className="sr-only">
          {announcement}
        </span>
      )}
    </div>
  );
}
