"use client";

import { useRef, type KeyboardEvent, type MouseEvent, type ReactNode } from "react";
import { useVirtualizer } from "@tanstack/react-virtual";
import type { SortSpec } from "@/lib/solverRanking";

export type DataTableColumn<T, K extends string = string> = {
  id: K;
  header: string;
  cell: (row: T) => ReactNode;
  /** When set, the header renders as a sort button. */
  sortable?: boolean;
  align?: "left" | "right";
  /** Rendered as the row header (`<th scope="row">`) for screen readers. */
  isRowHeader?: boolean;
};

export type DataTableProps<T, K extends string> = {
  caption: string;
  columns: readonly DataTableColumn<T, K>[];
  rows: readonly T[];
  getRowKey: (row: T) => string;
  sorts?: readonly SortSpec<K>[];
  /** `multi` is true for shift-click / Shift+Enter (adds a secondary sort key). */
  onSort?: (key: K, multi: boolean) => void;
  /** Rows above this count are virtualised. */
  virtualizeAbove?: number;
  sortHint?: string;
};

const ARIA_SORT = { asc: "ascending", desc: "descending" } as const;

/**
 * Accessible data table primitive.
 * - Real `<table>` semantics with `aria-sort` on sorted headers and a sticky header.
 * - Multi-key sort: shift-click or Shift+Enter/Space on a header button.
 * - Below 640 px each row collapses into a labelled card (pure CSS, one DOM).
 * - Large data sets (> `virtualizeAbove` rows) are windowed with @tanstack/react-virtual.
 */
export function DataTable<T, K extends string>({
  caption,
  columns,
  rows,
  getRowKey,
  sorts = [],
  onSort,
  virtualizeAbove = 200,
  sortHint,
}: DataTableProps<T, K>) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const virtualize = rows.length > virtualizeAbove;
  const virtualizer = useVirtualizer({
    count: virtualize ? rows.length : 0,
    getScrollElement: () => scrollRef.current,
    estimateSize: () => 56,
    overscan: 10,
  });

  const items = virtualize ? virtualizer.getVirtualItems() : null;
  const visible: readonly T[] = items
    ? items.flatMap((v) => (v.index < rows.length ? [rows[v.index] as T] : []))
    : rows;
  const first = items?.[0];
  const last = items?.[items.length - 1];
  const padTop = first ? first.start : 0;
  const padBottom = last ? virtualizer.getTotalSize() - last.end : 0;

  const handleClick = (key: K) => (e: MouseEvent<HTMLButtonElement>) => onSort?.(key, e.shiftKey);
  const handleKey = (key: K) => (e: KeyboardEvent<HTMLButtonElement>) => {
    if (e.shiftKey && (e.key === "Enter" || e.key === " ")) {
      e.preventDefault();
      onSort?.(key, true);
    }
  };

  const cellBase = "px-3 sm:px-4 py-3 text-sm max-sm:flex max-sm:justify-between max-sm:gap-4 max-sm:py-1.5 max-sm:before:content-[attr(data-label)] max-sm:before:uppercase max-sm:before:tracking-wide max-sm:before:text-[10px] max-sm:before:text-vx-muted";

  return (
    <div
      ref={scrollRef}
      className={virtualize ? "max-h-[70vh] overflow-auto" : "overflow-x-auto"}
      tabIndex={virtualize ? 0 : undefined}
      aria-label={virtualize ? caption : undefined}
      role={virtualize ? "region" : undefined}
    >
      <table className="w-full border-collapse max-sm:block">
        <caption className="sr-only">
          {caption}
          {sortHint ? `. ${sortHint}` : ""}
        </caption>
        <thead className="sticky top-0 z-10 bg-vx-card max-sm:sr-only">
          <tr className="border-b border-vx-border">
            {columns.map((col) => {
              const idx = sorts.findIndex((s) => s.key === col.id);
              const spec = idx >= 0 ? sorts[idx] : null;
              return (
                <th
                  key={col.id}
                  scope="col"
                  aria-sort={spec && idx === 0 ? ARIA_SORT[spec.dir] : col.sortable ? "none" : undefined}
                  className={`px-3 sm:px-4 py-2.5 eyebrow text-[10px] sm:text-xs font-medium whitespace-nowrap ${
                    col.align === "right" ? "text-right" : "text-left"
                  }`}
                >
                  {col.sortable && onSort ? (
                    <button
                      type="button"
                      onClick={handleClick(col.id)}
                      onKeyDown={handleKey(col.id)}
                      className="inline-flex items-center gap-1 rounded hover:text-vx-text focus:outline-none focus-visible:ring-2 focus-visible:ring-vx-sage"
                    >
                      {col.header}
                      <span aria-hidden="true" className={spec ? "text-vx-sage" : "opacity-40"}>
                        {spec ? (spec.dir === "asc" ? "↑" : "↓") : "↕"}
                        {spec && sorts.length > 1 ? <sup>{idx + 1}</sup> : null}
                      </span>
                    </button>
                  ) : (
                    col.header
                  )}
                </th>
              );
            })}
          </tr>
        </thead>
        <tbody className="max-sm:block max-sm:space-y-3 max-sm:p-3">
          {padTop > 0 && (
            <tr aria-hidden="true">
              <td colSpan={columns.length} style={{ height: padTop, padding: 0 }} />
            </tr>
          )}
          {visible.map((row) => (
            <tr
              key={getRowKey(row)}
              className="border-b border-vx-line hover:bg-vx-surface/30 transition-colors max-sm:block max-sm:rounded-lg max-sm:border max-sm:border-vx-border max-sm:p-3"
            >
              {columns.map((col) => {
                const align = col.align === "right" ? "sm:text-right" : "text-left";
                return col.isRowHeader ? (
                  <th key={col.id} scope="row" data-label={col.header} className={`${cellBase} ${align} font-normal`}>
                    {col.cell(row)}
                  </th>
                ) : (
                  <td key={col.id} data-label={col.header} className={`${cellBase} ${align}`}>
                    {col.cell(row)}
                  </td>
                );
              })}
            </tr>
          ))}
          {padBottom > 0 && (
            <tr aria-hidden="true">
              <td colSpan={columns.length} style={{ height: padBottom, padding: 0 }} />
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}
