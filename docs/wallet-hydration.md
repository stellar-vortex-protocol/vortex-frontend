# Wallet Hydration Flow

How a previously-connected wallet session is silently restored on page load —
and, importantly, when it deliberately isn't. The nuance here isn't visible from
the UI: a returning user just sees the wallet already connected, or sees the
"Connect" button with no explanation for why they were logged out.

Relevant files: [`src/store/wallet.ts`](../src/store/wallet.ts) (`hydrate`) and
[`src/components/WalletHydrator.tsx`](../src/components/WalletHydrator.tsx).

## The flow

1. [`WalletHydrator`](../src/components/WalletHydrator.tsx) is mounted once in
   [`src/app/layout.tsx`](../src/app/layout.tsx). On first client paint (`useEffect`
   with an empty dependency array), it fires `useWalletStore.getState().hydrate()`
   and renders nothing.
2. `useWalletStore` is a Zustand store wrapped in `persist` (see
   [`src/store/wallet.ts`](../src/store/wallet.ts)), backed by `localStorage`
   under the key `vortex-wallet`. Only the `PersistedWalletState` slice is
   persisted (see [Persisted shape](#persisted-shape)) — so by the time
   `hydrate()` runs, the store has already been rehydrated from `localStorage`
   with whatever was last persisted, provided it passed validation.
3. `hydrate()` (in [`src/store/wallet.ts`](../src/store/wallet.ts)) then decides
   whether that persisted state is still trustworthy:

   - Returns immediately if the rehydrated state isn't connected.
   - Otherwise asks the wallet (via `walletAdapter`, see
     [`src/lib/wallet`](../src/lib/wallet/index.ts)) whether it is reachable
     and still allows this site, then re-reads the account and network from the
     wallet. See the [transition table](#state-transitions) for every outcome.

All wallet access in the store goes through `walletAdapter` (currently the
Freighter adapter); the store never imports `@stellar/freighter-api` directly.

## When it restores

Only when **all** of the following hold:

- `localStorage` says the app was last in a connected state (`isConnected: true`
  from the persisted snapshot).
- The Freighter extension is installed and reachable (`walletAdapter.isConnected()`).
- The extension still recognizes this site as **allowed**
  (`walletAdapter.isAllowed()`) — i.e. the user hasn't revoked the site's access
  in the extension since the last visit.

If all three hold, it re-fetches the current `address` and `network` directly
from Freighter (not from `localStorage`) and confirms `isConnected: true`. This
means the restored session always reflects the extension's current account/network,
even if the user switched accounts in Freighter since the last visit.

## When it deliberately doesn't

- **Nothing was persisted as connected** (`isConnected` was already `false`) —
  `hydrate()` returns immediately, no Freighter calls are made at all.
- **The extension is locked, uninstalled, or unreachable** — `isAppConnected` is
  `false`, so `allowed` short-circuits to `false` and the stale session is
  cleared.
- **The site's access was revoked** — `isAppConnected` is `true` but
  `isAllowed()` is `false` (the user removed this site from Freighter's allowed
  list). The persisted session is cleared rather than restored.
- **Any Freighter call throws** — e.g. the extension API rejects — the `catch`
  clears the session rather than leaving it in an inconsistent state.

Crucially, `hydrate()` **never calls `walletAdapter.connect()`** (Freighter's
`requestAccess()`), which is
the only call that pops the Freighter approval UI. That call only happens in
`connect()` (user-initiated, via
[`ConnectWalletButton`](../src/components/ConnectWalletButton.tsx)). Hydration is
strictly a read of already-granted access — if the extension would need to
prompt the user, hydration clears the session instead of prompting silently on
page load.

## Multi-tab reconciliation (#302)

`useWalletStore` persists to `localStorage` under `PERSIST_KEY` (`vortex-wallet`).
The browser's `storage` event fires in **every other same-origin tab** whenever
one tab writes that key, so [`WalletHydrator`](../src/components/WalletHydrator.tsx)
also registers a `storage` listener (once, alongside the mount-time `hydrate()`).

When another tab changes the persisted wallet slice, the listener parses the new
value and calls `useWalletStore.getState().syncFromStorage(persisted)`:

- **Already in sync** (`isConnected` and `address` match this tab) — no-op. This
  is what prevents a reconciliation loop: a tab's own reconciling write lands in
  the other tabs as a `storage` event, but by then every tab already agrees, so
  nothing further is written.
- **Another tab disconnected** (`persisted.isConnected === false`) — trusted
  directly; this tab clears its wallet state. A user-initiated disconnect is
  authoritative and there's nothing to re-verify.
- **Another tab connected or switched account** — the new address is adopted
  optimistically and then `hydrate()` re-confirms it against the extension
  (`isConnected` / `isAllowed` / `getPublicKey`), so a tab never trusts an
  account it can't verify.

The `storage` event never fires in the tab that made the change, so the
originating tab keeps the correct state from its own `set()` and is unaffected.

## Persisted shape

`PersistedWalletState` in [`src/store/wallet.ts`](../src/store/wallet.ts) is the
single definition of what is written to `localStorage`; `partialize` writes
exactly these fields and `isValidPersistedState` (used as the persist `merge`
guard) accepts exactly this shape:

| Field | Type | Notes |
|---|---|---|
| `address` | `string \| null` | Must be a valid Stellar public key when set |
| `lastKnownAddress` | `string \| null` | Must be a valid Stellar public key when set; survives disconnects so the UI can offer "Reconnect G..." |
| `network` | `string \| null` | As reported by the wallet, e.g. `TESTNET` |
| `isConnected` | `boolean` | Required |

A payload that doesn't match (corrupted or hand-edited `localStorage`, an
invalid address) is ignored on rehydrate and the store starts disconnected.
`networkMismatch`, `error`/`errorKey`, `notInstalled`, `isConnecting` and
`wasSessionCleared` are never persisted; they are recomputed at runtime.

## State transitions

`EXPECTED` is `NEXT_PUBLIC_NETWORK` upper-cased (`TESTNET` when unset).
Each row is covered by a test in [`src/store/wallet.test.ts`](../src/store/wallet.test.ts).

| Action | Condition | Resulting state |
|---|---|---|
| `connect()` | Wallet unreachable / not installed | Disconnected; `notInstalled: true`, `errorKey: wallet.error.freighterUnavailable` |
| `connect()` | User declines / wallet throws an `Error` | Disconnected; `error` = the wallet's message, `errorKey: null` |
| `connect()` | Wallet throws a non-`Error` | Disconnected; `errorKey: wallet.error.connectFailed` |
| `connect()` | Access granted | Connected; `address` and `lastKnownAddress` set; `networkMismatch` = network ≠ `EXPECTED` |
| `disconnect()` | — | Disconnected; `wasSessionCleared: true`; `lastKnownAddress` kept |
| `hydrate()` | Persisted `isConnected: false` | No-op; no wallet calls |
| `hydrate()` | Wallet reachable and site allowed | Connected with the wallet's current address/network; `networkMismatch` recomputed |
| `hydrate()` | Wallet locked or site access revoked | Disconnected; `wasSessionCleared: true`; `lastKnownAddress` = previous address |
| `hydrate()` | Wallet call throws (extension removed/unreachable) | Same as above |
| `hydrate()` | A user `connect()` started while waiting on the wallet | No change — the in-flight connect owns the state |
| `checkForChanges()` | Connected; account or network changed in the wallet | `address`, `lastKnownAddress`, `network`, `networkMismatch` updated |
| `checkForChanges()` | Wallet locked / unreachable | No change (a locked wallet isn't a revoked session) |
| `syncFromStorage()` | Other tab's snapshot matches this tab | No-op |
| `syncFromStorage()` | Other tab disconnected | Disconnected (trusted) |
| `syncFromStorage()` | Other tab connected or switched account | Address adopted, then re-verified via `hydrate()` |
| rehydrate | Persisted payload invalid | Ignored; store starts disconnected |

`checkForChanges()` is polled by
[`ConnectWalletButton`](../src/components/ConnectWalletButton.tsx) every 8 s while
connected, and on window focus / tab visibility, because the extension doesn't
push account or network changes.
