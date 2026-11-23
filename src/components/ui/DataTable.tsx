'use client';

import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
} from 'react';

/**
 * Accessible DataTable / DataGrid.
 *
 * Role choice (documented per WAI-ARIA):
 *  - `role="table"` is used when the table is read-only (no row selection and no
 *    interactive cell content). Screen readers announce it as a table and keep
 *    their native table navigation model.
 *  - `role="grid"` is used when rows are selectable or cells contain interactive
 *    widgets, so the roving-tabindex keyboard model is exposed to AT.
 *
 * Keyboard model (roving tabindex):
 *  - Arrow keys move the active cell (RTL-aware for horizontal movement).
 *  - Home/End move to first/last column, Ctrl+Home/Ctrl+End to first/last cell.
 *  - PageUp/PageDown move by a page of rows.
 *  - Enter/Space activate the focused cell (row selection or cell onActivate).
 *  - Focus is tracked by row key so it survives live data updates and
 *    virtualised scrolling; if the focused row disappears, focus moves to the
 *    nearest surviving row.
 *
 * Sortable headers render as native <button>s so they are reachable by Tab and
 * toggle on Enter/Space; the active column exposes `aria-sort`.
 */

export type SortDirection = 'asc' | 'desc';

export interface ColumnDef<T> {
  /** Stable column id. */
  id: string;
  /** Header label (already localised by the caller). */
  header: React.ReactNode;
  /** Cell accessor. */
  accessor: (row: T, rowIndex: number) => React.ReactNode;
  /** Enables sorting for this column. */
  sortable?: boolean;
  /** Text alignment. */
  align?: 'start' | 'center' | 'end';
  /**
   * Responsive priority. Columns with the lowest priority are collapsed first
   * when the viewport is below the mobile breakpoint (640px).
   */
  priority?: number;
  /** Optional per-cell activation handler (Enter/Space). */
  onActivate?: (row: T, rowIndex: number) => void;
  /** Optional className applied to header and body cells. */
  className?: string;
}

export interface DataTableProps<T> {
  columns: ReadonlyArray<ColumnDef<T>>;
  rows: ReadonlyArray<T>;
  /** Stable row key. */
  getRowKey: (row: T, rowIndex: number) => string;
  /** Accessible name for the table. */
  'aria-label'?: string;
  'aria-labelledby'?: string;
  /** Enables row selection (switches role to `grid`). */
  selectable?: boolean;
  selectedKeys?: ReadonlySet<string>;
  onSelectionChange?: (keys: Set<string>) => void;
  /** Controlled sort state. */
  sort?: { columnId: string; direction: SortDirection } | null;
  onSortChange?: (sort: { columnId: string; direction: SortDirection } | null) => void;
  /** Total row count when virtualising (defaults to rows.length). */
  rowCount?: number;
  /** Index of the first rendered row when virtualising. */
  rowStartIndex?: number;
  /** Renders a row; defaults to a plain <tr>. */
  renderRow?: (args: {
    row: T;
    rowIndex: number;
    rowKey: string;
    cells: React.ReactNode;
    props: React.HTMLAttributes<HTMLTableRowElement>;
  }) => React.ReactNode;
  /** Mobile breakpoint in px. */
  mobileBreakpoint?: number;
  className?: string;
  /** Optional caption. */
  caption?: React.ReactNode;
}

interface GridNavState {
  activeRow: number;
  activeCol: number;
}

interface GridNavApi {
  state: GridNavState;
  setActive: (row: number, col: number) => void;
  onKeyDown: (event: React.KeyboardEvent) => void;
  tabIndexFor: (row: number, col: number) => 0 | -1;
  cellRef: (row: number, col: number) => (el: HTMLElement | null) => void;
}

const GridNavContext = createContext<GridNavApi | null>(null);

function useGridNavigation({
  rowCount,
  colCount,
  isRTL,
  onActivate,
  pageSize = 10,
}: {
  rowCount: number;
  colCount: number;
  isRTL: boolean;
  onActivate: (row: number, col: number) => void;
  pageSize?: number;
}): GridNavApi {
  const [state, setState] = useState<GridNavState>({ activeRow: 0, activeCol: 0 });
  const cells = useRef(new Map<string, HTMLElement>());

  const clamp = useCallback(
    (row: number, col: number): GridNavState => ({
      activeRow: Math.max(0, Math.min(row, Math.max(0, rowCount - 1))),
      activeCol: Math.max(0, Math.min(col, Math.max(0, colCount - 1))),
    }),
    [rowCount, colCount],
  );

  const setActive = useCallback(
    (row: number, col: number) => setState(clamp(row, col)),
    [clamp],
  );

  // Keep the active cell in range when rows/columns change (live updates).
  useEffect(() => {
    setState((prev) => {
      const next = clamp(prev.activeRow, prev.activeCol);
      return next.activeRow === prev.activeRow && next.activeCol === prev.activeCol
        ? prev
        : next;
    });
  }, [clamp]);

  const focusCell = useCallback((row: number, col: number) => {
    const el = cells.current.get(`${row}:${col}`);
    if (el) el.focus();
  }, []);

  const move = useCallback(
    (row: number, col: number) => {
      const next = clamp(row, col);
      setState(next);
      focusCell(next.activeRow, next.activeCol);
    },
    [clamp, focusCell],
  );

  const onKeyDown = useCallback(
    (event: React.KeyboardEvent) => {
      const { activeRow, activeCol } = state;
      const forward = isRTL ? -1 : 1;
      switch (event.key) {
        case 'ArrowRight':
          event.preventDefault();
          move(activeRow, activeCol + forward);
          break;
        case 'ArrowLeft':
          event.preventDefault();
          move(activeRow, activeCol - forward);
          break;
        case 'ArrowDown':
          event.preventDefault();
          move(activeRow + 1, activeCol);
          break;
        case 'ArrowUp':
          event.preventDefault();
          move(activeRow - 1, activeCol);
          break;
        case 'Home':
          event.preventDefault();
          if (event.ctrlKey || event.metaKey) move(0, 0);
          else move(activeRow, 0);
          break;
        case 'End':
          event.preventDefault();
          if (event.ctrlKey || event.metaKey) move(rowCount - 1, colCount - 1);
          else move(activeRow, colCount - 1);
          break;
        case 'PageDown':
          event.preventDefault();
          move(activeRow + pageSize, activeCol);
          break;
        case 'PageUp':
          event.preventDefault();
          move(activeRow - pageSize, activeCol);
          break;
        case 'Enter':
        case ' ':
          event.preventDefault();
          onActivate(activeRow, activeCol);
          break;
        default:
          break;
      }
    },
    [state, isRTL, move, rowCount, colCount, pageSize, onActivate],
  );

  const tabIndexFor = useCallback(
    (row: number, col: number): 0 | -1 =>
      row === state.activeRow && col === state.activeCol ? 0 : -1,
    [state],
  );

  const cellRef = useCallback(
    (row: number, col: number) => (el: HTMLElement | null) => {
      const key = `${row}:${col}`;
      if (el) cells.current.set(key, el);
      else cells.current.delete(key);
    },
    [],
  );

  return useMemo(
    () => ({ state, setActive, onKeyDown, tabIndexFor, cellRef }),
    [state, setActive, onKeyDown, tabIndexFor, cellRef],
  );
}

function useIsRTL(): boolean {
  const [isRTL, setIsRTL] = useState(false);
  useEffect(() => {
    if (typeof document === 'undefined') return;
    const el = document.documentElement;
    const update = () => setIsRTL(el.getAttribute('dir') === 'rtl');
    update();
    const observer = new MutationObserver(update);
    observer.observe(el, { attributes: true, attributeFilter: ['dir'] });
    return () => observer.disconnect();
  }, []);
  return isRTL;
}

function useIsMobile(breakpoint: number): boolean {
  const [isMobile, setIsMobile] = useState(false);
  useEffect(() => {
    if (typeof window === 'undefined' || !window.matchMedia) return;
    const query = window.matchMedia(`(max-width: ${breakpoint - 1}px)`);
    const update = () => setIsMobile(query.matches);
    update();
    query.addEventListener('change', update);
    return () => query.removeEventListener('change', update);
  }, [breakpoint]);
  return isMobile;
}

const alignClass: Record<NonNullable<ColumnDef<unknown>['align']>, string> = {
  start: 'text-start',
  center: 'text-center',
  end: 'text-end',
};

function nextSortDirection(
  current: { columnId: string; direction: SortDirection } | null | undefined,
  columnId: string,
): SortDirection {
  if (current && current.columnId === columnId) {
    return current.direction === 'asc' ? 'desc' : 'asc';
  }
  return 'asc';
}

function ariaSortFor(
  sort: { columnId: string; direction: SortDirection } | null | undefined,
  columnId: string,
): 'ascending' | 'descending' | 'none' {
  if (!sort || sort.columnId !== columnId) return 'none';
  return sort.direction === 'asc' ? 'ascending' : 'descending';
}

export function DataTable<T>({
  columns,
  rows,
  getRowKey,
  'aria-label': ariaLabel,
  'aria-labelledby': ariaLabelledBy,
  selectable = false,
  selectedKeys,
  onSelectionChange,
  sort,
  onSortChange,
  rowCount,
  rowStartIndex = 0,
  renderRow,
  mobileBreakpoint = 640,
  className,
  caption,
}: DataTableProps<T>) {
  const isRTL = useIsRTL();
  const isMobile = useIsMobile(mobileBreakpoint);
  const captionId = useId();

  const visibleColumns = useMemo(() => {
    if (!isMobile) return columns;
    return columns.filter((col) => (col.priority ?? 0) <= 1);
  }, [columns, isMobile]);

  const totalRows = rowCount ?? rows.length;
  const hasInteractiveCells = visibleColumns.some((col) => col.onActivate);
  const role = selectable || hasInteractiveCells ? 'grid' : 'table';

  const handleSort = useCallback(
    (columnId: string) => {
      if (!onSortChange) return;
      onSortChange({ columnId, direction: nextSortDirection(sort, columnId) });
    },
    [onSortChange, sort],
  );

  const handleActivate = useCallback(
    (rowIndex: number, colIndex: number) => {
      const column = visibleColumns[colIndex];
      if (!column) return;
      const row = rows[rowIndex];
      if (row === undefined) return;
      if (column.onActivate) {
        column.onActivate(row, rowIndex);
      } else if (selectable && onSelectionChange) {
        const key = getRowKey(row, rowIndex);
        const next = new Set(selectedKeys ?? []);
        if (next.has(key)) next.delete(key);
        else next.add(key);
        onSelectionChange(next);
      }
    },
    [visibleColumns, rows, selectable, onSelectionChange, selectedKeys, getRowKey],
  );

  const nav = useGridNavigation({
    rowCount: rows.length,
    colCount: visibleColumns.length,
    isRTL,
    onActivate: handleActivate,
  });

  const labelledBy = ariaLabelledBy ?? (caption ? captionId : undefined);

  return (
    <GridNavContext.Provider value={nav}>
      <div className={className}>
        <table
          role={role}
          aria-label={ariaLabel}
          aria-labelledby={labelledBy}
          aria-rowcount={totalRows}
          className="w-full border-collapse text-sm"
        >
          {caption ? (
            <caption id={captionId} className="sr-only">
              {caption}
            </caption>
          ) : null}
          <thead>
            <tr role="row">
              {visibleColumns.map((column) => {
                const sortable = Boolean(column.sortable && onSortChange);
                const ariaSort = sortable ? ariaSortFor(sort, column.id) : undefined;
                return (
                  <th
                    key={column.id}
                    role="columnheader"
                    scope="col"
                    aria-sort={ariaSort}
                    className={[
                      'border-b border-neutral-200 px-3 py-2 font-medium text-neutral-700',
                      alignClass[column.align ?? 'start'],
                      column.className,
                    ]
                      .filter(Boolean)
                      .join(' ')}
                  >
                    {sortable ? (
                      <button
                        type="button"
                        onClick={() => handleSort(column.id)}
                        className="inline-flex items-center gap-1 rounded-sm font-medium text-inherit focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-1"
                      >
                        <span>{column.header}</span>
                        <span aria-hidden="true" className="text-xs text-neutral-500">
                          {ariaSort === 'ascending' ? '\u25B2' : ariaSort === 'descending' ? '\u25BC' : '\u2195'}
                        </span>
                      </button>
                    ) : (
                      column.header
                    )}
                  </th>
                );
              })}
            </tr>
          </thead>
          <tbody>
            {rows.map((row, rowIndex) => {
              const rowKey = getRowKey(row, rowIndex);
              const selected = selectable && selectedKeys?.has(rowKey);
              const cells = visibleColumns.map((column, colIndex) => (
                <td
                  key={column.id}
                  role="gridcell"
                  tabIndex={nav.tabIndexFor(rowIndex, colIndex)}
                  ref={nav.cellRef(rowIndex, colIndex)}
                  onKeyDown={nav.onKeyDown}
                  onFocus={() => nav.setActive(rowIndex, colIndex)}
                  aria-selected={selectable ? Boolean(selected) : undefined}
                  className={[
                    'border-b border-neutral-100 px-3 py-2',
                    alignClass[column.align ?? 'start'],
                    column.className,
                  ]
                    .filter(Boolean)
                    .join(' ')}
                >
                  {column.accessor(row, rowIndex)}
                </td>
              ));
              const rowProps: React.HTMLAttributes<HTMLTableRowElement> = {
                role: 'row',
                'aria-rowindex': rowStartIndex + rowIndex + 1,
                'aria-selected': selectable ? Boolean(selected) : undefined,
                className: selected ? 'bg-blue-50' : undefined,
              };
              if (renderRow) {
                return (
                  <React.Fragment key={rowKey}>
                    {renderRow({ row, rowIndex, rowKey, cells, props: rowProps })}
                  </React.Fragment>
                );
              }
              return (
                <tr key={rowKey} {...rowProps}>
                  {cells}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </GridNavContext.Provider>
  );
}

export default DataTable;
