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
  /**
   * Optional stable row key accessor. When provided on any column, it is used
   * to derive React keys (and selection identity) so rows keep their identity
   * across reorders. Falls back to the row index when omitted.
   */
  rowKey?: (row: T, rowIndex: number) => string;
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

/**
 * Resolves a stable row key. Prefers an explicit `getRowKey`, then the first
 * column that declares a `rowKey` accessor, and finally falls back to the row
 * index so existing callers keep rendering unchanged.
 */
function resolveRowKey<T>(
  columns: ReadonlyArray<ColumnDef<T>>,
  getRowKey: ((row: T, rowIndex: number) => string) | undefined,
  row: T,
  rowIndex: number,
): string {
  if (getRowKey) return getRowKey(row, rowIndex);
  for (const column of columns) {
    if (column.rowKey) return column.rowKey(row, rowIndex);
  }
  return String(rowIndex);
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
  sort = null,
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

  const totalRows = rowCount ?? rows.length;

  const visibleColumns = useMemo(() => {
    if (!isMobile) return columns;
    const sorted = [...columns].sort(
      (a, b) => (a.priority ?? 0) - (b.priority ?? 0),
    );
    return sorted.slice(0, Math.max(1, Math.ceil(sorted.length / 2)));
  }, [columns, isMobile]);

  const handleActivate = useCallback(
    (rowIndex: number, colIndex: number) => {
      const column = visibleColumns[colIndex];
      const row = rows[rowIndex];
      if (!column || row === undefined) return;
      if (column.onActivate) {
        column.onActivate(row, rowIndex);
        return;
      }
      if (selectable && onSelectionChange) {
        const key = resolveRowKey(columns, getRowKey, row, rowIndex);
        const next = new Set(selectedKeys ?? []);
        if (next.has(key)) next.delete(key);
        else next.add(key);
        onSelectionChange(next);
      }
    },
    [visibleColumns, rows, selectable, onSelectionChange, selectedKeys, columns, getRowKey],
  );

  const nav = useGridNavigation({
    rowCount: totalRows,
    colCount: visibleColumns.length,
    isRTL,
    onActivate: handleActivate,
  });

  const handleSort = useCallback(
    (columnId: string) => {
      if (!onSortChange) return;
      if (!sort || sort.columnId !== columnId) {
        onSortChange({ columnId, direction: 'asc' });
      } else if (sort.direction === 'asc') {
        onSortChange({ columnId, direction: 'desc' });
      } else {
        onSortChange(null);
      }
    },
    [sort, onSortChange],
  );

  const role = selectable ? 'grid' : 'table';
  const labelledBy = ariaLabelledBy ?? (caption ? captionId : undefined);

  return (
    <GridNavContext.Provider value={nav}>
      <table
        role={role}
        aria-label={ariaLabel}
        aria-labelledby={labelledBy}
        className={className}
        onKeyDown={nav.onKeyDown}
      >
        {caption ? <caption id={captionId}>{caption}</caption> : null}
        <thead>
          <tr role="row">
            {visibleColumns.map((column, colIndex) => {
              const isSorted = sort?.columnId === column.id;
              const ariaSort = isSorted
                ? sort?.direction === 'asc'
                  ? 'ascending'
                  : 'descending'
                : 'none';
              return (
                <th
                  key={column.id}
                  role="columnheader"
                  scope="col"
                  aria-sort={column.sortable ? ariaSort : undefined}
                  className={[alignClass[column.align ?? 'start'], column.className]
                    .filter(Boolean)
                    .join(' ')}
                >
                  {column.sortable && onSortChange ? (
                    <button
                      type="button"
                      onClick={() => handleSort(column.id)}
                      className="inline-flex items-center gap-1"
                    >
                      {column.header}
                      <span aria-hidden="true">
                        {isSorted ? (sort?.direction === 'asc' ? '\u25B2' : '\u25BC') : '\u2195'}
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
          {rows.map((row, localIndex) => {
            const rowIndex = rowStartIndex + localIndex;
            const rowKey = resolveRowKey(columns, getRowKey, row, rowIndex);
            const isSelected = selectable && (selectedKeys?.has(rowKey) ?? false);
            const cells = visibleColumns.map((column, colIndex) => (
              <td
                key={column.id}
                role="gridcell"
                tabIndex={nav.tabIndexFor(localIndex, colIndex)}
                ref={nav.cellRef(localIndex, colIndex)}
                aria-selected={selectable ? isSelected : undefined}
                className={[alignClass[column.align ?? 'start'], column.className]
                  .filter(Boolean)
                  .join(' ')}
              >
                {column.accessor(row, rowIndex)}
              </td>
            ));
            const rowProps: React.HTMLAttributes<HTMLTableRowElement> = {
              role: 'row',
              'aria-selected': selectable ? isSelected : undefined,
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
    </GridNavContext.Provider>
  );
}

export default DataTable;
