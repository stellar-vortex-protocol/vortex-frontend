"use client";

import { useCallback, useEffect, useLayoutEffect, useRef, useState, type KeyboardEvent, type ReactNode } from "react";
import { useVirtualizer } from "@tanstack/react-virtual";

type SavedScroll = { offset: number; activeIndex: number; count: number; firstKey: string | null };

export type VirtualListProps<T> = {
  items: readonly T[];
  renderRow: (item: T, state: { index: number; active: boolean }) => ReactNode;
  getKey: (item: T) => string;
  estimateSize?: number;
  onActivate?: (item: T, index: number) => void;
  /** sessionStorage key used to restore scroll + active row on back navigation. */
  restoreKey?: string;
  /** Changing this value (e.g. serialised filters) resets scroll to the top. */
  resetKey?: string;
  label: string;
  gap?: number;
  className?: string;
};

const STORAGE_PREFIX = "vortex-vlist:";

function readSaved(key: string): SavedScroll | null {
  try {
    const raw = sessionStorage.getItem(STORAGE_PREFIX + key);
    return raw ? (JSON.parse(raw) as SavedScroll) : null;
  } catch {
    return null;
  }
}

/**
 * Restoration is skipped when the data set changed materially since the
 * position was saved: a different first item or a >20% change in size.
 */
export function isRestorable(saved: SavedScroll, count: number, firstKey: string | null): boolean {
  if (saved.firstKey !== firstKey) return false;
  const base = Math.max(saved.count, 1);
  return Math.abs(count - saved.count) / base <= 0.2;
}

export function nextActiveIndex(key: string, current: number, count: number, pageSize: number): number | null {
  if (count === 0) return null;
  switch (key) {
    case "ArrowDown":
      return Math.min(current + 1, count - 1);
    case "ArrowUp":
      return Math.max(current - 1, 0);
    case "Home":
      return 0;
    case "End":
      return count - 1;
    case "PageDown":
      return Math.min(current + pageSize, count - 1);
    case "PageUp":
      return Math.max(current - pageSize, 0);
    default:
      return null;
  }
}

/**
 * Windowed single-column grid with measured (variable) row heights, roving active row
 * keyboard navigation and sessionStorage-backed scroll restoration.
 */
export function VirtualList<T>({
  items,
  renderRow,
  getKey,
  estimateSize = 96,
  onActivate,
  restoreKey,
  resetKey,
  label,
  gap = 8,
  className = "max-h-[70vh] overflow-y-auto",
}: VirtualListProps<T>) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const [activeIndex, setActiveIndex] = useState(0);
  const firstKey = items.length > 0 ? getKey(items[0] as T) : null;
  const firstKeyRef = useRef(firstKey);
  const restoredRef = useRef(false);

  const virtualizer = useVirtualizer({
    count: items.length,
    getScrollElement: () => scrollRef.current,
    estimateSize: () => estimateSize + gap,
    getItemKey: (index) => getKey(items[index] as T),
    overscan: 8,
  });

  // Anchor to the visible item when rows are prepended above the viewport so
  // streamed-in data doesn't shift what the user is looking at.
  const prevCountRef = useRef(items.length);
  useLayoutEffect(() => {
    const prevFirst = firstKeyRef.current;
    const added = items.length - prevCountRef.current;
    prevCountRef.current = items.length;
    firstKeyRef.current = firstKey;
    const el = scrollRef.current;
    if (!el || added <= 0 || prevFirst === null || prevFirst === firstKey || el.scrollTop === 0) return;
    const shiftedIndex = items.findIndex((item) => getKey(item) === prevFirst);
    if (shiftedIndex > 0) {
      el.scrollTop += shiftedIndex * (estimateSize + gap);
      setActiveIndex((i) => i + shiftedIndex);
    }
  }, [items, firstKey, getKey, estimateSize, gap]);

  // Restore once, when the list first has data.
  useEffect(() => {
    if (restoredRef.current || !restoreKey || items.length === 0) return;
    restoredRef.current = true;
    const saved = readSaved(restoreKey);
    if (!saved || !isRestorable(saved, items.length, firstKey)) return;
    const index = Math.min(saved.activeIndex, items.length - 1);
    setActiveIndex(index);
    requestAnimationFrame(() => {
      if (scrollRef.current) scrollRef.current.scrollTop = saved.offset;
    });
  }, [restoreKey, items.length, firstKey]);

  // Filter/sort change → back to the top.
  const lastResetKeyRef = useRef(resetKey);
  useEffect(() => {
    if (lastResetKeyRef.current === resetKey) return;
    lastResetKeyRef.current = resetKey;
    setActiveIndex(0);
    virtualizer.scrollToIndex(0);
  }, [resetKey, virtualizer]);

  const save = useCallback(() => {
    if (!restoreKey) return;
    try {
      const payload: SavedScroll = {
        offset: scrollRef.current?.scrollTop ?? 0,
        activeIndex,
        count: items.length,
        firstKey,
      };
      sessionStorage.setItem(STORAGE_PREFIX + restoreKey, JSON.stringify(payload));
    } catch {
      // Storage unavailable (private mode) - restoration is best-effort.
    }
  }, [restoreKey, activeIndex, items.length, firstKey]);

  useEffect(() => save, [save]);

  const clampedActive = Math.min(activeIndex, Math.max(items.length - 1, 0));

  const handleKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    if (e.key === "Enter") {
      const item = items[clampedActive];
      if (item !== undefined && onActivate) {
        e.preventDefault();
        save();
        onActivate(item, clampedActive);
      }
      return;
    }
    const visible = virtualizer.getVirtualItems().length;
    const next = nextActiveIndex(e.key, clampedActive, items.length, Math.max(visible - 2, 1));
    if (next === null) return;
    e.preventDefault();
    setActiveIndex(next);
    virtualizer.scrollToIndex(next, { align: "auto" });
  };

  const activeKey = items[clampedActive] !== undefined ? getKey(items[clampedActive] as T) : undefined;

  return (
    <div
      ref={scrollRef}
      className={`${className} focus:outline-none focus-visible:ring-2 focus-visible:ring-vx-sage rounded-lg`}
      role="grid"
      tabIndex={0}
      aria-label={label}
      aria-rowcount={items.length}
      aria-activedescendant={activeKey ? `vrow-${activeKey}` : undefined}
      onKeyDown={handleKeyDown}
    >
      <div style={{ height: virtualizer.getTotalSize(), position: "relative" }}>
        {virtualizer.getVirtualItems().map((row) => {
          const item = items[row.index] as T;
          const key = getKey(item);
          const active = row.index === clampedActive;
          return (
            <div
              key={row.key}
              id={`vrow-${key}`}
              ref={virtualizer.measureElement}
              data-index={row.index}
              role="row"
              aria-selected={active}
              aria-rowindex={row.index + 1}
              onClickCapture={save}
              style={{
                position: "absolute",
                top: 0,
                left: 0,
                width: "100%",
                paddingBottom: gap,
                transform: `translateY(${row.start}px)`,
              }}
              className={active ? "[&>*>*]:border-vx-sage/60" : undefined}
            >
              <div role="gridcell">{renderRow(item, { index: row.index, active })}</div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
