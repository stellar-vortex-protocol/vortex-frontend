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
