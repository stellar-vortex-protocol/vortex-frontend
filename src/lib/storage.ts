/**
 * Typed storage facade and the central registry of every key the app persists.
 *
 * All browser storage access goes through this module (enforced by the
 * `no-restricted-globals` / `no-restricted-properties` rules in
 * `.eslintrc.json`). The facade is SSR-safe, never throws, handles quota
 * errors, records last-updated timestamps, enforces the retention policy
 * declared in `STORAGE_KEYS`, and supports a "private mode" in which personal
 * data (drafts, address history, recents) lives in `sessionStorage` only.
 *
 * See docs/privacy-and-local-data.md for the full inventory and trade-offs.
 */

import { secureLogger } from "./secureLogging";
import type { MessageKey } from "./i18n";

export type Sensitivity = "preference" | "personal";

export interface StorageKeyDef {
  /** Exact key, or key prefix when `prefix` is true. */
  key: string;
  prefix?: boolean;
  /** i18n key describing why the value is stored. */
  purpose: MessageKey;
  sensitivity: Sensitivity;
  /** Maximum age before the value is purged on load; `null` = kept until cleared. */
  retentionMs: number | null;
  /** Module that owns (reads/writes) the key. */
  owner: string;
}

const DAY = 24 * 60 * 60 * 1000;

export const STORAGE_KEYS = {
  wallet: {
    key: "vortex-wallet",
    purpose: "privacy.purpose.wallet",
    sensitivity: "personal",
    retentionMs: null,
    owner: "src/store/wallet.ts",
  },
  recentChains: {
    key: "vortex:recentChains",
    purpose: "privacy.purpose.recentChains",
    sensitivity: "personal",
    retentionMs: 30 * DAY,
    owner: "src/hooks/useRecentChains.ts",
  },
  solverRegistrationDraft: {
    key: "vortex:solver-registration-draft",
    purpose: "privacy.purpose.draft",
    sensitivity: "personal",
    retentionMs: DAY,
    owner: "src/hooks/useLocalStorageDraft.ts",
  },
  knownAddresses: {
    key: "vortex:knownAddresses",
    purpose: "privacy.purpose.knownAddresses",
    sensitivity: "personal",
    retentionMs: 90 * DAY,
    owner: "src/lib/knownAddresses.ts",
  },
  columnVisibility: {
    key: "vortex:columns:",
    prefix: true,
    purpose: "privacy.purpose.columns",
    sensitivity: "preference",
    retentionMs: null,
    owner: "src/hooks/useColumnVisibility.ts",
  },
  motionPreference: {
    key: "vortex-motion-preference",
    purpose: "privacy.purpose.motion",
    sensitivity: "preference",
    retentionMs: null,
    owner: "src/components/SettingsPanel.tsx",
  },
  onboardingSeen: {
    key: "vortex-onboarding-seen",
    purpose: "privacy.purpose.onboarding",
    sensitivity: "preference",
    retentionMs: null,
    owner: "src/components/OnboardingHints.tsx",
  },
  solverOnboardingDismissed: {
    key: "vortex_solver_onboarding_dismissed",
    purpose: "privacy.purpose.onboarding",
    sensitivity: "preference",
    retentionMs: null,
    owner: "src/app/solve/SolvePageClient.tsx",
  },
  privateMode: {
    key: "vortex:privateMode",
    purpose: "privacy.purpose.privateMode",
    sensitivity: "preference",
    retentionMs: null,
    owner: "src/lib/storage.ts",
  },
  meta: {
    key: "vortex:storage-meta",
    purpose: "privacy.purpose.meta",
    sensitivity: "preference",
    retentionMs: null,
    owner: "src/lib/storage.ts",
  },
} as const satisfies Record<string, StorageKeyDef>;

const REGISTRY: readonly StorageKeyDef[] = Object.values(STORAGE_KEYS);

/** Keys that look like ours but are no longer registered are shown as "legacy". */
const APP_KEY_RE = /^vortex[-_:]/;

/** Total stored size above which the privacy page warns (browsers cap ~5 MB). */
export const STORAGE_WARN_BYTES = 4 * 1024 * 1024;

const CHANNEL_NAME = "vortex-storage";

export function describeKey(key: string): StorageKeyDef | null {
  return REGISTRY.find((d) => (d.prefix ? key.startsWith(d.key) : d.key === key)) ?? null;
}

function getBackend(kind: "local" | "session"): Storage | null {
  if (typeof window === "undefined") return null;
  try {
    return kind === "local" ? window.localStorage : window.sessionStorage;
  } catch {
    return null;
  }
}

function safeGet(store: Storage | null, key: string): string | null {
  try {
    return store?.getItem(key) ?? null;
  } catch {
    return null;
  }
}

function safeRemove(store: Storage | null, key: string): void {
  try {
    store?.removeItem(key);
  } catch {
    // ignore — storage unavailable
  }
}

function safeSet(store: Storage | null, key: string, value: string): boolean {
  if (!store) return false;
  try {
    store.setItem(key, value);
    return true;
  } catch (err) {
    secureLogger.warn("Storage write failed (quota or unavailable)", { key, err });
    return false;
  }
}

// ── Private mode ─────────────────────────────────────────────────────────────

export function isPrivateMode(): boolean {
  return safeGet(getBackend("local"), STORAGE_KEYS.privateMode.key) === "1";
}

/** Personal data is kept in sessionStorage only while private mode is on. */
function backendFor(key: string): Storage | null {
  const def = describeKey(key);
  if (def?.sensitivity === "personal" && isPrivateMode()) return getBackend("session");
  return getBackend("local");
}

export function setPrivateMode(enabled: boolean): void {
  const local = getBackend("local");
  if (enabled) {
    safeSet(local, STORAGE_KEYS.privateMode.key, "1");
    // Drop anything personal already persisted to disk.
    for (const entry of listEntries()) {
      if (entry.def?.sensitivity === "personal") safeRemove(local, entry.key);
    }
  } else {
    safeRemove(local, STORAGE_KEYS.privateMode.key);
  }
  broadcast();
}

// ── Metadata (last-updated timestamps) ───────────────────────────────────────

type Meta = Record<string, number>;

function readMeta(): Meta {
  try {
    const raw = safeGet(getBackend("local"), STORAGE_KEYS.meta.key);
    const parsed: unknown = raw ? JSON.parse(raw) : {};
    return parsed && typeof parsed === "object" ? (parsed as Meta) : {};
  } catch {
    return {};
  }
}

function writeMeta(update: (meta: Meta) => void): void {
  const meta = readMeta();
  update(meta);
  safeSet(getBackend("local"), STORAGE_KEYS.meta.key, JSON.stringify(meta));
}

// ── Facade ───────────────────────────────────────────────────────────────────

let initialized = false;

function ensureInitialized(): void {
  if (initialized || typeof window === "undefined") return;
  initialized = true;
  enforceRetention();
}

export const storage = {
  getItem(key: string): string | null {
    ensureInitialized();
    return safeGet(backendFor(key), key);
  },
  setItem(key: string, value: string): boolean {
    ensureInitialized();
    const ok = safeSet(backendFor(key), key, value);
    if (ok && key !== STORAGE_KEYS.meta.key) writeMeta((m) => void (m[key] = Date.now()));
    return ok;
  },
  removeItem(key: string): void {
    safeRemove(getBackend("local"), key);
    safeRemove(getBackend("session"), key);
    if (key !== STORAGE_KEYS.meta.key) writeMeta((m) => void delete m[key]);
  },
  getJSON<T>(key: string): T | null {
    const raw = this.getItem(key);
    if (!raw) return null;
    try {
      return JSON.parse(raw) as T;
    } catch {
      return null;
    }
  },
  setJSON(key: string, value: unknown): boolean {
    return this.setItem(key, JSON.stringify(value));
  },
};

// ── Inventory, retention, export, clear ──────────────────────────────────────

export interface StorageEntry {
  key: string;
  def: StorageKeyDef | null;
  /** Approximate size in bytes (UTF-16). */
  bytes: number;
  updatedAt: number | null;
  location: "local" | "session";
}

export function listEntries(): StorageEntry[] {
  const meta = readMeta();
  const entries: StorageEntry[] = [];
  for (const location of ["local", "session"] as const) {
    const store = getBackend(location);
    if (!store) continue;
    let length = 0;
    try {
      length = store.length;
    } catch {
      continue;
    }
    for (let i = 0; i < length; i++) {
      const key = store.key(i);
      if (!key) continue;
      const def = describeKey(key);
      if (!def && !APP_KEY_RE.test(key)) continue;
      const value = safeGet(store, key) ?? "";
      entries.push({
        key,
        def,
        bytes: (key.length + value.length) * 2,
        updatedAt: meta[key] ?? null,
        location,
      });
    }
  }
  return entries.sort((a, b) => a.key.localeCompare(b.key));
}

export function totalBytes(entries: StorageEntry[] = listEntries()): number {
  return entries.reduce((sum, e) => sum + e.bytes, 0);
}

/** Purges values older than their declared retention. Returns purged keys. */
export function enforceRetention(now: number = Date.now()): string[] {
  const meta = readMeta();
  const purged: string[] = [];
  for (const entry of listEntries()) {
    const retention = entry.def?.retentionMs;
    const updatedAt = meta[entry.key];
    if (retention && updatedAt !== undefined && now - updatedAt > retention) {
      storage.removeItem(entry.key);
      purged.push(entry.key);
    }
  }
  return purged;
}

/** Exports every app-owned value as JSON. The app never stores secrets. */
export function exportData(): { exportedAt: string; entries: Record<string, unknown> } {
  const entries: Record<string, unknown> = {};
  for (const entry of listEntries()) {
    if (entry.key === STORAGE_KEYS.meta.key) continue;
    const raw = safeGet(getBackend(entry.location), entry.key);
    try {
      entries[entry.key] = raw === null ? null : JSON.parse(raw);
    } catch {
      entries[entry.key] = raw;
    }
  }
  return { exportedAt: new Date().toISOString(), entries };
}

export function clearKey(key: string): void {
  storage.removeItem(key);
  broadcast([key]);
}

/** Removes every app-owned key from local and session storage. */
export function clearAll(): void {
  const keys = listEntries().map((e) => e.key);
  for (const key of keys) {
    safeRemove(getBackend("local"), key);
    safeRemove(getBackend("session"), key);
  }
  broadcast(keys);
}

// ── Multi-tab notifications ──────────────────────────────────────────────────

function broadcast(keys: string[] = []): void {
  if (typeof BroadcastChannel === "undefined") return;
  try {
    const channel = new BroadcastChannel(CHANNEL_NAME);
    channel.postMessage({ type: "changed", keys });
    channel.close();
  } catch {
    // ignore
  }
}

/** Subscribes to storage changes made in other tabs. Returns an unsubscribe fn. */
export function onStorageChange(callback: () => void): () => void {
  if (typeof window === "undefined") return () => {};
  const channel = typeof BroadcastChannel !== "undefined" ? new BroadcastChannel(CHANNEL_NAME) : null;
  if (channel) channel.onmessage = callback;
  window.addEventListener("storage", callback);
  return () => {
    channel?.close();
    window.removeEventListener("storage", callback);
  };
}

/** Test helper: reset the once-per-load retention guard. */
export function __resetStorageForTests(): void {
  initialized = false;
}
