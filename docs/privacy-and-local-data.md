# Privacy & Local Data

Vortex never stores private keys, seed phrases or signed transactions. Everything the app persists lives only in the user's browser and is listed on the **`/privacy`** page (linked in the footer). From there users can inspect the data, export it as JSON, clear single entries, or use **Clear all & disconnect**.

## Storage facade

All browser storage goes through `src/lib/storage.ts`. ESLint `no-restricted-globals` / `no-restricted-properties` rules reject direct `localStorage`/`sessionStorage` use anywhere else, tests excepted. The facade:

- is SSR-safe and never throws; it logs quota errors via `secureLogger` and returns `false`;
- records a last-updated timestamp per key (`vortex:storage-meta`);
- enforces retention once per page load, purging values older than their declared retention;
- notifies other tabs of clears and private-mode changes via `BroadcastChannel` (plus the native `storage` event);
- backs the Zustand wallet store (`createJSONStorage(() => storage)`).

## Inventory (`STORAGE_KEYS`)

| Key | Purpose | Sensitivity | Retention | Owner |
|---|---|---|---|---|
| `vortex-wallet` | Connected address + network | personal | until cleared | `src/store/wallet.ts` |
| `vortex:recentChains` | Recently picked chains | personal | 30 days | `useRecentChains` |
| `vortex:solver-registration-draft` | Solver registration draft | personal | 1 day | `useLocalStorageDraft` |
| `vortex:knownAddresses` | Address-poisoning reference set | personal | 90 days | `src/lib/knownAddresses.ts` |
| `vortex:columns:*` | Table column visibility | preference | until cleared | `useColumnVisibility` |
| `vortex-motion-preference` | Reduced-motion preference | preference | until cleared | `SettingsPanel` |
| `vortex-onboarding-seen`, `vortex_solver_onboarding_dismissed` | Onboarding dismissed | preference | until cleared | `OnboardingHints`, `SolvePageClient` |
| `vortex:privateMode` | Private mode flag | preference | until cleared | `storage.ts` |
| `vortex:storage-meta` | Last-updated timestamps | preference | until cleared | `storage.ts` |

Keys that start with `vortex` but are not in the registry (left over from older versions) appear as **legacy** and can be cleared.

The page warns when app storage exceeds 4 MB, because browsers cap storage at about 5 MB.

## Private mode

When private mode is on, **personal** keys are written to `sessionStorage` only, and any already on disk are deleted. Preferences such as motion and column visibility still persist.

Trade-offs:
- Drafts, recents and address history are lost when the tab closes.
- The wallet session does not survive a browser restart.
- Address-poisoning warnings only compare against this session's history.
