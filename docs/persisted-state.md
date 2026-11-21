# Persisted state

Persisted Zustand slices (wallet session, saved views, and future preference
slices) go through `createSyncedPersist` in `src/lib/persist.ts` instead of
calling `persist` directly. It adds:

- **Versioning + migrations.** Each slice declares a `version` and an ordered
  `migrations` array where `migrations[n]` upgrades a v`n` payload to v`n + 1`.
- **Validation on rehydrate.** `validate` (for example `isValidPersistedState`
  in `src/store/wallet.ts`) runs after migration and on every cross-tab payload.
- **Safe reset.** A payload from an unknown (newer) version, one that fails
  validation, or one that cannot be parsed is discarded. The store keeps its
  initial state and `onReset` fires once so the UI can show a toast
  (`persist.reset.toast`).
- **Cross-tab sync.** Changes to the persisted slice are broadcast over
  `BroadcastChannel` (`vortex-sync:<name>`), falling back to the `storage`
  event. Messages carry the sender's tab id and schema version, so a tab never
  re-applies its own write and ignores other versions. Changes applied from a
  remote tab are never re-broadcast.
- **Storage failures.** Disabled storage falls back to in-memory storage, and
  quota errors on write are swallowed so the in-memory state stays usable.
- **SSR.** Nothing touches `window` until the store runs in a browser.

Draft content (`useLocalStorageDraft`) is intentionally **not** synced across
tabs.

## Registering a storage key

Every key the app persists must be declared in `STORAGE_KEYS` in
`src/lib/storage.ts` and read/written through the `storage` facade. Direct
`localStorage` / `sessionStorage` access is rejected by the
`no-restricted-globals` and `no-restricted-properties` rules in
`.eslintrc.json`, whose message points back to this section.

A `STORAGE_KEYS` entry is a `StorageKeyDef`:

| Field         | Meaning                                                                 |
| ------------- | ----------------------------------------------------------------------- |
| `key`         | Exact storage key, or key prefix when `prefix: true`.                   |
| `prefix`      | Set when `key` is a prefix (e.g. per-address drafts).                   |
| `purpose`     | i18n key (`privacy.purpose.*`) explaining why the value is stored.      |
| `sensitivity` | `"preference"` (kept on disk) or `"personal"` (moved to sessionStorage in private mode). |
| `retentionMs` | Max age before the value is purged on load; `null` keeps it until cleared. |
| `owner`       | Module that reads/writes the key.                                       |

Registration also feeds the privacy inventory (`listEntries`), retention
enforcement, last-updated metadata, and the private-mode purge.

### Before

```ts
// src/hooks/useRecentChains.ts
const KEY = "vortex:recentChains";

export function readRecentChains(): string[] {
  const raw = localStorage.getItem(KEY); // lint error: use the storage facade
  return raw ? (JSON.parse(raw) as string[]) : [];
}

export function writeRecentChains(chains: string[]): void {
  localStorage.setItem(KEY, JSON.stringify(chains)); // lint error
}
```

### After

```ts
// src/lib/storage.ts — declare the key once
export const STORAGE_KEYS = {
  // …
  recentChains: {
    key: "vortex:recentChains",
    purpose: "privacy.purpose.recentChains",
    sensitivity: "personal",
    retentionMs: 30 * DAY,
    owner: "src/hooks/useRecentChains.ts",
  },
} as const;

// src/hooks/useRecentChains.ts — go through the facade
import { STORAGE_KEYS, storage } from "@/lib/storage";

export function readRecentChains(): string[] {
  return storage.getJSON<string[]>(STORAGE_KEYS.recentChains.key) ?? [];
}

export function writeRecentChains(chains: string[]): void {
  storage.setJSON(STORAGE_KEYS.recentChains.key, chains);
}
```

Checklist when adding a key:

1. Add the entry to `STORAGE_KEYS` with a `purpose` i18n key present in both
   `en.ts` and `es.ts`.
2. Pick `sensitivity` and `retentionMs` deliberately — personal data must be
   purgeable and must not outlive its retention window.
3. Use `storage.getItem` / `setItem` / `getJSON` / `setJSON` (or
   `useLocalStorageDraft` for drafts) instead of touching `window` storage.
4. Run `npm run lint`; a direct storage call now fails with a message naming
   `STORAGE_KEYS` and linking this section.

## Changing a persisted shape

1. Update the persisted type and its `validate` function.
2. Bump the slice's version constant (e.g. `WALLET_PERSIST_VERSION`).
3. Append one migration step that turns the previous shape into the new one.
   Never edit or reorder shipped steps: returning users may still hold any
   older version.
4. **Required:** add a migration test with a fixture of the previous shape to
   `src/lib/persist.test.ts` (or the slice's own test). Also keep the
   "one step per shipped version" assertion passing.

## Wallet specifics

`useWalletStore` routes remote snapshots through `syncFromStorage`: a
disconnect in another tab is applied immediately (blocking submissions in
this tab), and a changed account is adopted and then re-verified with the
extension via `hydrate()`. Unrelated, non-persisted state such as an in-flight
submission is never touched by sync.
