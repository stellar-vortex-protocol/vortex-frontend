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
   under the key `vortex-wallet`. Only `address`, `network`, and `isConnected`
   are persisted (`partialize`) — so by the time `hydrate()` runs, the store has
   already been rehydrated from `localStorage` with whatever was last persisted.
3. `hydrate()` (in [`src/store/wallet.ts`](../src/store/wallet.ts)) then decides
   whether that persisted state is still trustworthy:

   ```ts
   hydrate: async () => {
     if (!get().isConnected) return;
     try {
       const isAppConnected = await freighterApi.isConnected();
       const allowed = isAppConnected && (await freighterApi.isAllowed());
       if (!allowed) {
         set({ address: null, network: null, isConnected: false, error: null });
         return;
       }

       const address = await freighterApi.getPublicKey();
       const network = await freighterApi.getNetwork();
       set({ address, network, isConnected: true, error: null });
     } catch {
       set({ address: null, network: null, isConnected: false, error: null });
     }
   },
   ```

## When it restores

Only when **all** of the following hold:

- `localStorage` says the app was last in a connected state (`isConnected: true`
  from the persisted snapshot).
- The Freighter extension is installed and reachable (`freighterApi.isConnected()`).
- The extension still recognizes this site as **allowed**
  (`freighterApi.isAllowed()`) — i.e. the user hasn't revoked the site's access
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

Crucially, `hydrate()` **never calls `freighterApi.requestAccess()`**, which is
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
