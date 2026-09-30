/**
 * useLocalStorageDraft
 *
 * Provides debounced persistence of an arbitrary draft value to localStorage,
 * with TTL-based expiry and a wallet-address guard so stale drafts from a
 * different wallet are never silently restored.
 *
 * Usage:
 *   const [draft, setDraft, clearDraft] = useLocalStorageDraft<MyDraft>(
 *     "solver-registration",
 *     connectedWalletAddress ?? null,
 *   );
 *
 * Behaviour:
 * - Reads on mount; returns null when the key is absent, the TTL has elapsed,
 *   or the stored wallet address doesn't match the current one.
 * - Writes are debounced (default 500 ms) to avoid thrashing localStorage on
 *   every keystroke.
 * - `clearDraft()` removes the entry immediately (no debounce).
 */

import { useCallback, useEffect, useRef, useState } from "react";

const DEFAULT_DEBOUNCE_MS = 500;
const DEFAULT_TTL_MS = 24 * 60 * 60 * 1000; // 24 hours

type StoredEntry<T> = {
  value: T;
  savedAt: number;
  walletAddress: string | null;
  version?: number;
};

function readEntry<T>(key: string): StoredEntry<T> | null {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return null;
    return JSON.parse(raw) as StoredEntry<T>;
  } catch {
    return null;
  }
}

function writeEntry<T>(key: string, value: T, walletAddress: string | null, version?: number): void {
  try {
    const entry: StoredEntry<T> = { value, savedAt: Date.now(), walletAddress, version };
    localStorage.setItem(key, JSON.stringify(entry));
  } catch {
    // Silently ignore quota errors — draft persistence is best-effort.
  }
}

function removeEntry(key: string): void {
  try {
    localStorage.removeItem(key);
  } catch {
    // ignore
  }
}

export function useLocalStorageDraft<T>(
  key: string,
  walletAddress: string | null,
  options?: { debounceMs?: number; ttlMs?: number; version?: number; validate?: (value: unknown) => value is T },
): [T | null, (value: T) => void, () => void] {
  const debounceMs = options?.debounceMs ?? DEFAULT_DEBOUNCE_MS;
  const ttlMs = options?.ttlMs ?? DEFAULT_TTL_MS;

  // Read on mount — return null for absent, expired, or wrong-wallet entries.
  const [draft, setDraftState] = useState<T | null>(() => {
    if (typeof window === "undefined") return null;
    const entry = readEntry<T>(key);
    if (!entry) return null;
    if (Date.now() - entry.savedAt > ttlMs) {
      removeEntry(key);
      return null;
    }
    if (entry.walletAddress !== walletAddress) {
      removeEntry(key);
      return null;
    }
    if (options?.version !== undefined && entry.version !== options.version) { removeEntry(key); return null; }
    if (options?.validate && !options.validate(entry.value)) { removeEntry(key); return null; }
    return entry.value;
  });

  // Keep a stable ref to the latest wallet address so the debounced write
  // always uses the current value (avoids stale closure issues).
  const walletRef = useRef(walletAddress);
  useEffect(() => {
    walletRef.current = walletAddress;
  }, [walletAddress]);

  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const setDraft = useCallback(
    (value: T) => {
      setDraftState(value);
      if (timerRef.current !== null) clearTimeout(timerRef.current);
      timerRef.current = setTimeout(() => {
        writeEntry(key, value, walletRef.current, options?.version);
        timerRef.current = null;
      }, debounceMs);
    },
    [key, debounceMs],
  );

  const clearDraft = useCallback(() => {
    if (timerRef.current !== null) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
    setDraftState(null);
    removeEntry(key);
  }, [key]);

  // Clean up any pending debounced write on unmount.
  useEffect(() => {
    return () => {
      if (timerRef.current !== null) clearTimeout(timerRef.current);
    };
  }, []);

  return [draft, setDraft, clearDraft];
}
