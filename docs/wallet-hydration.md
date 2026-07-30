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
