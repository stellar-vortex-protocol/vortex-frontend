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

Both sources are ingested into one normalized entity store,
[`useIntentStore`](../src/store/intents.ts), through a single
`ingest(items, source, view?)` action:

- `byId` holds one record per intent id; `views` holds ordered id lists for the
  `feed` (homepage, cap 8), `explore` (cap 200) and `mine` views, newest first.
- Every write goes through the pure
  [`reconcile`](../src/lib/realtime/reconcile.ts): status transitions are
  monotonic (`pending → accepted → filled|failed`; regressions are rejected),
  the higher `version`/`updatedAt` wins, and fields are merged so a
  `FeedItem` never overwrites richer `IntentDetail` fields.
- Eviction is LRU by `receivedAt` once the store exceeds 1000 entries.
- Components read through memoised selectors (`selectFeed(limit)`,
  `selectExplore(limit)`, `selectMine(address)`, `selectById(id)`), so they
  re-render only when the ids or records they display change.

[`useIntentFeed`](../src/hooks/useIntentFeed.ts),
[`useLiveIntents`](../src/hooks/useLiveIntents.ts) and
[`useMyLiveIntents`](../src/hooks/useMyLiveIntents.ts) keep their public API but
are thin wrappers around [`useLiveIntentView`](../src/hooks/useLiveIntentView.ts),
which ingests the SWR snapshot, subscribes to validated WebSocket frames and,
on every reconnect, revalidates the SWR key to backfill missed updates
(`isCatchingUp` is true meanwhile; existing rows are never cleared).

Optimistic submissions (see `useSwapSubmission`) are also stored here:

```
submitIntent start ──► optimistic (pending) ──► REST/WS record ──► confirmed (replaced in place)
        │                     │
        │ failure             └─ 60 s without a record ──► unconfirmed ("Check status")
        ▼
   rolled back (removed, error toast once)
```

Optimistic entries are never persisted, are dropped on wallet account change,
and are excluded from analytics and CSV exports.

The WebSocket URL for all of these is `config.wsUrl` from `src/lib/config.ts`
(`NEXT_PUBLIC_WS_URL`, or `null` when unset), and `useWebSocket(null)` is the deliberate way
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

## API client (`apiFetch`)

`src/lib/api.ts` is the only path to the relay. Options: `{ signal, retry, idempotencyKey, validator }`.

- **Timeout & cancellation:** each attempt has a 10 s timeout. A caller
  `signal` is merged with the timeout controller via manual listeners (no
  reliance on `AbortSignal.any`) and listeners are removed afterwards. Caller
  aborts reject with `AbortError`; only the internal timeout yields `TimeoutError`.
- **Retries:** GETs retry network errors, timeouts and 5xx with exponential
  backoff (`DEFAULT_RETRIES`, opt out with `retry: false`). SWR fetchers created
  by `endpoint()` opt out because SWR's global policy owns retries. POSTs retry
  only when an `Idempotency-Key` is present, and reuse the same key.
- **Idempotency:** money-moving POSTs (`createIntent`, `submitIntent`,
  `acceptIntent`, `registerSolver`, `submitSolverRegistration`) send an
  `Idempotency-Key` (`crypto.randomUUID()`), overridable per call. *Assumption:*
  the relay de-duplicates requests with the same key and returns the original
  response; until it does, a retried POST may be processed twice, so retries are
  limited to network errors/timeouts/5xx.
- **Correlation:** every request carries an `X-Request-Id`; the id is attached
  to `ApiError`/`TimeoutError`/`ClientError` and shown (copyable) by `ErrorState`.
- **Error bodies:** truncated to `MAX_ERROR_BODY` characters and only ever
  rendered as text. JSON bodies expose `code`/`message` on `ApiError`;
  `Retry-After` is parsed into `retryAfterMs`.

See [data-fetching.md](./data-fetching.md) for the SWR policy.

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

## Internationalisation

There is one translation system: `src/lib/i18n`.

- **Catalogs:** one per locale in `src/lib/i18n/messages/` (`en.ts` is the
  source of truth, `es.ts` must have exactly the same keys). Keys are
  namespaced by feature (`swap.*`, `solve.*`, `governance.*`, …) and values may
  contain `{placeholder}` tokens, which must match across locales.
- **Client components:** `const { t } = useTranslation()` from
  `src/lib/i18n/I18nProvider.tsx`. The locale is switched from `SettingsPanel`
  and every component re-renders in it.
- **Server components:** `getTranslation()` from `src/lib/i18n/server.ts`
  (e.g. `layout.tsx`, the dynamic-import fallbacks in `page.tsx` files).
- **Keys are literals or typed maps.** `t("swap.submit.cta")`, or a
  `Record<Status, MessageKey>` lookup; never `t(\`prefix.${value}\`)`, which
  can't be checked statically.

`npm run check:i18n` (`scripts/check-i18n-parity.mjs`, run in CI) fails on
missing or extra keys, mismatched placeholders, unknown or template-built keys,
and hard-coded user-facing text in JSX under `src/app/**` and
`src/components/**` (JSX text and `aria-label` / `title` / `placeholder` /
`alt` strings). Brand names and symbols that stay the same in every language
go in `scripts/i18n-literal-allowlist.json`; everything else goes in the
catalogs. `src/lib/i18n/pages.es.test.tsx` renders the routed pages under `es`.

Adding a string: add the key to `en.ts` **and** `es.ts`, then use `t()`.
Adding a locale is a separate change (new catalog file plus `CATALOGS`).
