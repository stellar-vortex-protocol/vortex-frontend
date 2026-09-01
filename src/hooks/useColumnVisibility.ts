import { useCallback, useEffect, useState } from "react";

export type ColumnVisibility<K extends string> = Record<K, boolean>;

/**
 * A persisted show/hide preference for a fixed set of list columns.
 *
 * - `alwaysVisible` columns are forced on and cannot be toggled off.
 * - Unknown keys in a stale persisted value are ignored (the app's column set
 *   may have changed since the preference was written).
 */
export function useColumnVisibility<K extends string>(
  storageKey: string,
  allColumns: readonly K[],
  alwaysVisible: readonly K[] = [],
): {
  visibility: ColumnVisibility<K>;
  toggle: (column: K) => void;
  isToggleable: (column: K) => boolean;
} {
  const buildDefault = useCallback(
    (): ColumnVisibility<K> =>
      Object.fromEntries(allColumns.map((c) => [c, true])) as ColumnVisibility<K>,
    [allColumns],
  );

  const readStored = useCallback((): ColumnVisibility<K> => {
    const base = buildDefault();
    try {
      const raw = localStorage.getItem(storageKey);
      if (!raw) return base;
      const parsed = JSON.parse(raw) as Record<string, unknown>;
      for (const column of allColumns) {
        if (typeof parsed[column] === "boolean") {
          base[column] = parsed[column] as boolean;
        }
      }
    } catch {
      // Malformed / unavailable storage - fall back to all-visible.
    }
    for (const column of alwaysVisible) base[column] = true;
    return base;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [storageKey, allColumns, buildDefault]);

  const [visibility, setVisibility] = useState<ColumnVisibility<K>>(buildDefault);

  // Hydrate from storage after mount so server and first client render agree.
  useEffect(() => {
    setVisibility(readStored());
  }, [readStored]);

  const persist = useCallback(
    (next: ColumnVisibility<K>) => {
      try {
        localStorage.setItem(storageKey, JSON.stringify(next));
      } catch {
        // Ignore - the preference just won't survive a reload.
      }
    },
    [storageKey],
  );

  const isToggleable = useCallback(
    (column: K) => !alwaysVisible.includes(column),
    [alwaysVisible],
  );

  const toggle = useCallback(
    (column: K) => {
      if (alwaysVisible.includes(column)) return;
      setVisibility((current) => {
        const next = { ...current, [column]: !current[column] };
        persist(next);
        return next;
      });
    },
    [alwaysVisible, persist],
  );

  return { visibility, toggle, isToggleable };
}
