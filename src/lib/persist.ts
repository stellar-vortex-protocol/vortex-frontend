import type { StateCreator, StoreApi, StoreMutatorIdentifier } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";

/**
 * Versioned, cross-tab-synchronised `persist` for Zustand slices (#440).
 *
 * - `version` + ordered `migrations`: `migrations[n]` upgrades a v`n` payload
 *   to v`n + 1`. A payload newer than `version` (or one that fails `validate`
 *   after migration) is reset to the store's initial state and `onReset` fires
 *   once so the UI can explain why preferences were cleared.
 * - Cross-tab propagation uses `BroadcastChannel`, falling back to the
 *   `storage` event where it is unavailable (older Safari, some private modes).
 *   Each message carries the sender's tab id and schema version, so a tab never
 *   re-applies its own write and never applies a payload from another version.
 * - SSR-safe: nothing touches `window` until the store runs in a browser.
 *
 * See docs/persisted-state.md for the contributor workflow.
 */

export type Migration = (state: unknown) => unknown;

export type ResetReason = "unknown-version" | "invalid" | "corrupted";

export type SyncedPersistOptions<T, P> = {
  /** localStorage key; also used to name the BroadcastChannel. */
  name: string;
  /** Current schema version. Bump it whenever the persisted shape changes. */
  version: number;
  /** `migrations[n]` upgrades a v`n` payload to v`n + 1`. Length must equal `version`. */
  migrations?: readonly Migration[];
  partialize: (state: T) => P;
  /** Runtime check applied after migration and to every cross-tab payload. */
  validate: (value: unknown) => value is P;
  /**
   * Optional clean-up applied after `validate` (on rehydrate and to remote
   * payloads), e.g. to drop individual corrupted list entries.
   */
  sanitize?: (value: P) => P;
  /**
   * Applies a validated snapshot written by another tab. Defaults to merging
   * it into the store with `setState`.
   */
  onRemoteState?: (remote: P, api: StoreApi<T>) => void;
  /** Called once when a persisted payload had to be discarded. */
  onReset?: (reason: ResetReason) => void;
};

export type SyncMessage<P> = { tabId: string; version: number; state: P };

/** Runs ordered migrations. Returns `null` when `fromVersion` is unsupported. */
export function runMigrations(
  persisted: unknown,
  fromVersion: number,
  toVersion: number,
  migrations: readonly Migration[] = [],
): unknown | null {
  if (!Number.isInteger(fromVersion) || fromVersion < 0 || fromVersion > toVersion) return null;
  let state = persisted;
  for (let v = fromVersion; v < toVersion; v += 1) {
    const step = migrations[v];
    if (!step) return null;
    state = step(state);
  }
  return state;
}

function createTabId(): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  return `${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

function safeLocalStorage(): Storage {
  // Accessing localStorage can throw (disabled storage, sandboxed iframes);
  // a no-op storage keeps the store usable in-memory.
  try {
    const storage = window.localStorage;
    const probe = "__vortex_probe__";
    storage.setItem(probe, probe);
    storage.removeItem(probe);
    return storage;
  } catch {
    const memory = new Map<string, string>();
    return {
      get length() {
        return memory.size;
      },
      clear: () => memory.clear(),
      getItem: (key) => memory.get(key) ?? null,
      key: (index) => Array.from(memory.keys())[index] ?? null,
      removeItem: (key) => void memory.delete(key),
      setItem: (key, value) => void memory.set(key, value),
    };
  }
}

/** Wraps a JSON storage so quota errors on write are swallowed, not thrown. */
function quotaSafeStorage(): Storage {
  const storage = safeLocalStorage();
  return {
    get length() {
      return storage.length;
    },
    clear: () => storage.clear(),
    getItem: (key) => storage.getItem(key),
    key: (index) => storage.key(index),
    removeItem: (key) => storage.removeItem(key),
    setItem: (key, value) => {
      try {
        storage.setItem(key, value);
      } catch {
        // QuotaExceededError: keep the in-memory state; the next write retries.
      }
    },
  };
}

type Transport<P> = {
  post: (message: SyncMessage<P>) => void;
  close: () => void;
};

function openTransport<P>(
  name: string,
  onMessage: (message: unknown) => void,
): Transport<P> | null {
  if (typeof window === "undefined") return null;

  if (typeof BroadcastChannel !== "undefined") {
    try {
      const channel = new BroadcastChannel(`vortex-sync:${name}`);
      channel.onmessage = (event: MessageEvent) => onMessage(event.data);
      return {
        post: (message) => channel.postMessage(message),
        close: () => channel.close(),
      };
    } catch {
      // Fall through to the storage-event transport.
    }
  }

  // Fallback: the `storage` event only fires in *other* tabs when the persist
  // key is written, so the persist write itself is the transport.
  const onStorage = (event: StorageEvent) => {
    if (event.key !== name || event.newValue === null) return;
    try {
      const parsed = JSON.parse(event.newValue) as { state?: unknown; version?: unknown };
      onMessage({ tabId: "storage-event", version: parsed.version, state: parsed.state });
    } catch {
      // Malformed write from another tab: ignore.
    }
  };
  window.addEventListener("storage", onStorage);
  return {
    post: () => undefined,
    close: () => window.removeEventListener("storage", onStorage),
  };
}

export function isSyncMessage(value: unknown): value is SyncMessage<unknown> {
  if (typeof value !== "object" || value === null) return false;
  const msg = value as Record<string, unknown>;
  return typeof msg["tabId"] === "string" && typeof msg["version"] === "number" && "state" in msg;
}

function shallowEqual(a: unknown, b: unknown): boolean {
  if (Object.is(a, b)) return true;
  if (typeof a !== "object" || typeof b !== "object" || a === null || b === null) return false;
  const aKeys = Object.keys(a);
  if (aKeys.length !== Object.keys(b).length) return false;
  return aKeys.every((key) =>
    Object.is((a as Record<string, unknown>)[key], (b as Record<string, unknown>)[key]),
  );
}

/**
 * Drop-in replacement for `persist(initializer, options)`.
 */
export function createSyncedPersist<
  T,
  P,
  Mps extends [StoreMutatorIdentifier, unknown][] = [],
  Mcs extends [StoreMutatorIdentifier, unknown][] = [],
>(
  initializer: StateCreator<T, [...Mps, ["zustand/persist", unknown]], Mcs>,
  options: SyncedPersistOptions<T, P>,
): StateCreator<T, Mps, [["zustand/persist", P], ...Mcs]> {
  const { name, version, migrations = [], partialize, validate, onRemoteState, onReset } = options;
  const sanitize = options.sanitize ?? ((value: P) => value);
  let resetReported = false;
  const reportReset = (reason: ResetReason) => {
    if (resetReported) return;
    resetReported = true;
    onReset?.(reason);
  };

  const persisted = persist<T, Mps, Mcs, P>(initializer, {
    name,
    version,
    storage: createJSONStorage(() => quotaSafeStorage()),
    partialize,
    migrate: (state, fromVersion) => {
      const migrated = runMigrations(state, fromVersion, version, migrations);
      if (migrated === null) {
        reportReset("unknown-version");
        // Returning the (unmerged) initial slice resets the store.
        return {} as P;
      }
      if (!validate(migrated)) {
        reportReset("invalid");
        return {} as P;
      }
      return migrated as P;
    },
    merge: (persistedState, current) => {
      if (persistedState === undefined || persistedState === null) return current;
      if (typeof persistedState === "object" && Object.keys(persistedState).length === 0) {
        return current;
      }
      if (!validate(persistedState)) {
        reportReset("invalid");
        return current;
      }
      return { ...current, ...(sanitize(persistedState) as object) };
    },
    onRehydrateStorage: () => (_state, error) => {
      if (!error) return;
      reportReset("corrupted");
      try {
        window.localStorage.removeItem(name);
      } catch {
        // Storage unavailable; nothing to clean up.
      }
    },
  });

  return (set, get, api) => {
    const state = persisted(set, get, api);
    if (typeof window === "undefined") return state;

    const tabId = createTabId();
    let applyingRemote = false;
    const storeApi = api as unknown as StoreApi<T>;

    const transport = openTransport<P>(name, (message) => {
      if (!isSyncMessage(message) || message.tabId === tabId) return;
      if (message.version !== version || !validate(message.state)) return;
      const remote = sanitize(message.state);
      // Loop protection: an identical snapshot is a no-op, and changes applied
      // from a remote tab are never re-broadcast.
      if (shallowEqual(partialize(storeApi.getState()), remote)) return;
      applyingRemote = true;
      try {
        if (onRemoteState) onRemoteState(remote, storeApi);
        else storeApi.setState(remote as unknown as Partial<T>);
      } finally {
        applyingRemote = false;
      }
    });

    if (transport) {
      storeApi.subscribe((next, prev) => {
        if (applyingRemote) return;
        const nextSlice = partialize(next);
        if (shallowEqual(nextSlice, partialize(prev))) return;
        transport.post({ tabId, version, state: nextSlice });
      });
    }

    return state;
  };
}
