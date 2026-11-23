/**
 * Single source of truth for persisted storage keys.
 *
 * Both the storage facade (`src/lib/storage.ts`) and the lint rule that
 * enforces `STORAGE_KEYS` registration import this symbol, so a key only
 * needs to be registered here.
 */
export const STORAGE_KEYS = {
  theme: 'handsoff:theme',
  locale: 'handsoff:locale',
  wallet: 'handsoff:wallet',
  network: 'handsoff:network',
  onboarding: 'handsoff:onboarding',
  recentSearches: 'handsoff:recent-searches',
  favorites: 'handsoff:favorites',
  notifications: 'handsoff:notifications',
} as const;

export type StorageKey = keyof typeof STORAGE_KEYS;
export type StorageKeyValue = (typeof STORAGE_KEYS)[StorageKey];
