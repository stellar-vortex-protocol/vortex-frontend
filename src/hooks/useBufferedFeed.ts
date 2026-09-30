import { useCallback, useEffect, useMemo, useRef, useState } from "react";

export const DEFAULT_BUFFER_CAP = 500;

type Identified = { id: string };

export type BufferedFeed<T> = {
  /** Items to render: accepted items only while paused, in source order. */
  visible: T[];
  /** Number of buffered (not yet shown) items, capped at `cap`. */
  pending: number;
  /** True when more than `cap` items are buffered. */
  overflow: boolean;
  /** Reveal every buffered item. */
  flush: () => void;
};

/**
 * Buffers live inserts while `isPaused`, so rows don't shift under the cursor.
 * Items already shown keep updating in place (status changes etc.) because
 * `visible` is always derived from the latest `items` array.
 */
export function useBufferedFeed<T extends Identified>(
  items: T[],
  { isPaused, cap = DEFAULT_BUFFER_CAP }: { isPaused: boolean; cap?: number },
): BufferedFeed<T> {
  const [accepted, setAccepted] = useState<ReadonlySet<string> | null>(null);
  const itemsRef = useRef(items);
  itemsRef.current = items;

  const acceptAll = useCallback(() => {
    setAccepted((current) => {
      const ids = itemsRef.current.map((item) => item.id);
      // Keep the same Set when nothing is new so this can't re-trigger renders.
      if (current && current.size === ids.length && ids.every((id) => current.has(id))) return current;
      return new Set(ids);
    });
  }, []);

  const hasSnapshot = accepted !== null;
  useEffect(() => {
    // The first non-empty snapshot is never buffered; live mode accepts everything.
    if (!isPaused || (!hasSnapshot && items.length > 0)) acceptAll();
  }, [acceptAll, hasSnapshot, isPaused, items]);

  return useMemo(() => {
    if (!isPaused || accepted === null) {
      return { visible: items, pending: 0, overflow: false, flush: acceptAll };
    }
    const visible: T[] = [];
    let buffered = 0;
    for (const item of items) {
      if (accepted.has(item.id)) visible.push(item);
      else buffered += 1;
    }
    return {
      visible,
      pending: Math.min(buffered, cap),
      overflow: buffered > cap,
      flush: acceptAll,
    };
  }, [acceptAll, accepted, cap, isPaused, items]);
}

const PAUSE_KEY_PREFIX = "vortex-feed-paused:";

/**
 * Tracks the reasons a feed should pause: pointer or focus inside the list,
 * the list scrolled off the top of the viewport, or the user's persisted
 * "Pause live updates" toggle (stored per feed id).
 */
export function useFeedPause(feedId: string) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [userPaused, setUserPaused] = useState(false);
  const [pointerInside, setPointerInside] = useState(false);
  const [focusInside, setFocusInside] = useState(false);
  const [scrolledAway, setScrolledAway] = useState(false);

  useEffect(() => {
    try {
      setUserPaused(window.localStorage.getItem(PAUSE_KEY_PREFIX + feedId) === "1");
    } catch {
      // Storage unavailable — default to live.
    }
  }, [feedId]);

  useEffect(() => {
    const onScroll = () => {
      const top = containerRef.current?.getBoundingClientRect().top;
      setScrolledAway(top !== undefined && top < 0);
    };
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  const toggle = useCallback(() => {
    setUserPaused((current) => {
      const next = !current;
      try {
        window.localStorage.setItem(PAUSE_KEY_PREFIX + feedId, next ? "1" : "0");
      } catch {
        // Preference still applies for this session.
      }
      return next;
    });
  }, [feedId]);

  const containerProps = {
    ref: containerRef,
    tabIndex: -1,
    onPointerEnter: () => setPointerInside(true),
    onPointerLeave: () => setPointerInside(false),
    onFocus: () => setFocusInside(true),
    onBlur: (event: React.FocusEvent<HTMLDivElement>) => {
      if (!event.currentTarget.contains(event.relatedTarget as Node | null)) setFocusInside(false);
    },
  };

  return {
    isPaused: userPaused || pointerInside || focusInside || scrolledAway,
    userPaused,
    toggle,
    /** For feeds with their own scroll container: report scrollTop > 0. */
    setScrolledAway,
    containerRef,
    containerProps,
  };
}
