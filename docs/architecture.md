# Architecture Overview

This document describes how data flows through the app: how the initial page load
gets its data, how that data stays live, and where global client state lives.
It links directly to the files involved rather than describing the pattern in the
abstract — read this alongside the linked source.

## REST snapshot + WebSocket layering

Most live-updating views (the homepage activity feed, the explore/browse intents
list) follow the same two-source pattern:

1. **REST snapshot** — an [SWR](https://swr.vercel.app/) hook fetches the current
   state from the API and provides the initial render plus periodic polling as a
   fallback.
2. **WebSocket layer** — [`useWebSocket`](../src/hooks/useWebSocket.ts) subscribes
   to the shared realtime connection (see [Realtime connection manager](#realtime-connection-manager))
   and each new message is merged on top of the REST snapshot, newest first,
   deduped by `id`.

This is implemented twice, at two different sizes:

- [`useIntentFeed`](../src/hooks/useIntentFeed.ts) — seeds from
  [`useActivityFeed`](../src/hooks/useActivityFeed.ts) (SWR, `refreshInterval: 8000`)
  and caps the merged list at 8 items. Used for the homepage's small preview list.
- [`useLiveIntents`](../src/hooks/useLiveIntents.ts) — seeds from
  [`useIntents`](../src/hooks/useIntents.ts) (plain SWR, no polling interval) and
  caps the merged list at 200 items. Used for the full explore/browse view.

Both hooks share the same shape of internals: a local `mergeById` de-duper, a
`liveItems` state array appended to on every WebSocket message, and an `isLive`
flag derived from the WebSocket's `status === "open"`. If you need a third feed
of this kind, follow this pattern (REST hook via SWR + `useWebSocket` + local
merge-by-id state) rather than inventing a new one.

The WebSocket URL for all of these is
`process.env.NEXT_PUBLIC_WS_URL`, and `useWebSocket(null)` is the deliberate way
to stay idle (e.g. when that env var is unset) — it tears down any existing
connection and reports `status: "closed"` without attempting to connect.

## Realtime connection manager

All WebSocket traffic goes through one module singleton,
[`src/lib/realtime/manager.ts`](../src/lib/realtime/manager.ts), so a tab holds
**one socket per URL** no matter how many hooks are mounted
(`useIntentFeed`, `useLiveIntents`, `useMyLiveIntents`, `useIntentStatusWatcher`).

- **Layers:** [`WebSocketClient`](../src/lib/realtime/webSocketClient.ts)
  (framework-agnostic state machine: `idle | connecting | open | backoff |
  unavailable | closed`) → `manager.ts` (ref counting, topic fan-out) →
  [`useRealtimeTopic` / `useRealtimeStatus`](../src/hooks/useRealtime.ts) →
  `useWebSocket` (back-compat `{ status, lastMessage, reconnect }`).
- **Ref counting:** the socket opens on the first `subscribe()`/`watchStatus()`
  and closes `LINGER_MS` (2 s) after the last handle is released, so route
  changes don't thrash the connection.
- **Topics:** frames with a string `topic` field are routed to that topic; frames
  without one go to `"intents"`. Subscribers may pass a client-side `filter`
  (e.g. by address). A throwing subscriber is logged via `secureLogger` and
  never breaks fan-out to the others.
- **Optional subscribe frames:** with `NEXT_PUBLIC_WS_SUBSCRIBE_FRAMES=true` the
  manager sends `{"type":"subscribe","topic":…}` when a topic gains its first
  subscriber (and on every reconnect) and `{"type":"unsubscribe",…}` when it
  loses its last. Off by default until the relay supports it.
- **Status:** `useRealtimeStatus(url)` is the single source for the
  "Live/Polling" indicators (`isLive` in the feed hooks).
- **SSR / hot reload:** `subscribe()` is a no-op on the server; `resetRealtime()`
  closes everything (used by tests).
- **Debugging:** in development, append `?debug=realtime` to any URL to show an
  overlay ([`RealtimeDebugOverlay`](../src/components/RealtimeDebugOverlay.tsx))
  listing connections, their state and subscriber counts per topic.

## SWR's role

SWR ([`src/lib/api.ts`](../src/lib/api.ts) provides the shared `fetcher`) is used
for every REST read in the app — not just the feeds above. See
[`useIntents`](../src/hooks/useIntents.ts), [`useMyIntents`](../src/hooks/useMyIntents.ts),
[`useSolvers`](../src/hooks/useSolvers.ts), [`useOpenIntents`](../src/hooks/useOpenIntents.ts),
[`useQuote`](../src/hooks/useQuote.ts), etc. SWR owns:

- request de-duplication and caching by key (the path string, e.g. `"/intents"`)
- `isLoading` / `error` state, so hooks don't hand-roll fetch state machines
- polling via `refreshInterval` where a hook wants it (e.g. `useActivityFeed`'s
  8s interval) as a fallback path even if the WebSocket is unavailable

The WebSocket is purely additive on top of SWR's data — it is never the sole
source of truth. If the socket never connects, the REST snapshot (optionally
polling) still renders correctly; the feed just won't say `isLive`.

## Zustand store boundaries

Global client state is split into two small, single-purpose
[Zustand](https://github.com/pmndrs/zustand) stores rather than one shared store.
Each owns a distinct concern and neither reaches into the other's state directly
(components that need both, like
[`ConnectWalletButton`](../src/components/ConnectWalletButton.tsx), import both
hooks side by side).

- **[`src/store/wallet.ts`](../src/store/wallet.ts)** (`useWalletStore`) — owns
  wallet connection state (`address`, `network`, `isConnected`, `isConnecting`,
  `error`) and the `connect` / `disconnect` / `hydrate` actions that talk to the
  active wallet adapter. Persisted to `localStorage` (key `vortex-wallet`) via
  `zustand/middleware`'s `persist`, but only `address` / `network` /
  `isConnected` are persisted (see `partialize`) — transient fields like
  `isConnecting` and `error` never survive a reload. See
  [`docs/wallet-hydration.md`](./wallet-hydration.md) for how `hydrate()` uses
  this persisted state on load.
- **[`src/store/toast.ts`](../src/store/toast.ts)** (`useToastStore`) — owns the
  transient notification queue (`toasts`) and the `addToast` / `dismissToast`
  actions. Not persisted; toasts are ephemeral by design. See
  [`docs/toast-system.md`](./toast-system.md) for its API.

Both stores are consumed directly via their hooks anywhere in the tree — there's
no context provider wrapping them. The only two places mounted unconditionally
are [`WalletHydrator`](../src/components/WalletHydrator.tsx) and
[`ToastViewport`](../src/components/ToastViewport.tsx), both mounted once in
[`src/app/layout.tsx`](../src/app/layout.tsx).
