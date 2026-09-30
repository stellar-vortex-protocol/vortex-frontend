# WebSocket Protocol

## Overview

The frontend connects to a WebSocket endpoint defined by `NEXT_PUBLIC_WS_URL`. Connection
lifecycle lives in `WebSocketClient` (`src/lib/realtime/webSocketClient.ts`); one client per URL
is shared by every hook through the realtime manager (see `docs/architecture.md`). Each frame is
expected to be a JSON object.

**Connection states:** `idle → connecting → open`, then on drop `backoff → connecting …`, ending
in `unavailable` after the attempt cap; `closed` once released or when the URL is `null`.

**Connection behavior:**

- Reconnect: exponential backoff starting at 3 s, doubling per attempt, capped at 60 s, with
  ±20 % jitter; after 10 consecutive failed attempts the state becomes `unavailable`.
- Attempts reset only after a **stable** open (the connection survived ≥ 10 s), not on `onopen`,
  so a server that accepts then immediately drops cannot cause a tight reconnect loop.
- Heartbeat watchdog: if no frame arrives for 45 s while open, the socket is treated as
  half-open, closed, and reconnected through backoff.
- Close codes: `1008` (policy violation) and `1003` (unsupported data) go straight to
  `unavailable`; others (`1000`, `1006`, …) reconnect with backoff.
- Offline/online: going offline pauses reconnects; coming back online retries immediately.
- Page visibility: returning to the tab while in `backoff`/`unavailable` retries immediately.
- Manual retry: `useWebSocket(url).reconnect()` / `useRealtimeStatus(url).reconnect()`.
- Status transitions never tear down the socket (the hook effect depends only on the URL).
- Late events from replaced sockets are ignored; malformed frames are silently dropped.
- Passing `null` as the URL tears down the subscription and stays idle.

## Feeds

Both feeds subscribe to the same `NEXT_PUBLIC_WS_URL` and expect identical JSON shapes.

### Live Intents feed

**Hook:** `src/hooks/useLiveIntents.ts`
**Type:** `FeedItem` from `src/lib/types.ts`
**Max items:** 200

### Intent feed (homepage preview)

**Hook:** `src/hooks/useIntentFeed.ts`
**Type:** `FeedItem` from `src/lib/types.ts`
**Max items:** 8
Seeds from REST `/intents/feed` (`src/hooks/useActivityFeed.ts`) and layers live updates on top.

## `FeedItem` Shape (Canonical)

```json
{
  "id": "string",
  "srcChain": "string",
  "srcToken": "string",
  "srcAmount": "string",
  "dstToken": "string",
  "solver": "string",
  "status": "pending | accepted | filled | failed",
  "createdAt": "ISO-8601 timestamp"
}
```

| Field       | Type     | Notes                                           |
| ----------- | -------- | ----------------------------------------------- |
| `id`        | `string` | Unique intent identifier                        |
| `srcChain`  | `string` | Source chain identifier                         |
| `srcToken`  | `string` | Source asset symbol                             |
| `srcAmount` | `string` | Human-readable amount                           |
| `dstToken`  | `string` | Destination asset symbol                        |
| `solver`    | `string` | Solver name or address                          |
| `status`    | `string` | Enum: `pending`, `accepted`, `filled`, `failed` |
| `createdAt` | `string` | ISO-8601 UTC timestamp                          |

## Accepted Message Shapes & Validation

Every frame is validated by `parseFeedItemFrame`
([`src/lib/realtime/quarantine.ts`](../src/lib/realtime/quarantine.ts)) before it
reaches state. Two shapes are accepted:

```json
{ "id": "i1", "srcChain": "ethereum", "srcToken": "USDC", "srcAmount": "10.5",
  "dstToken": "USDC", "solver": "Alpha", "status": "pending",
  "createdAt": "2026-07-14T00:00:00Z", "version": 3, "updatedAt": "2026-07-14T00:01:00Z" }
```

```json
{ "type": "intent", "data": { "...": "FeedItem as above" } }
```

Rules:

- Frames larger than 64 KB are dropped.
- Envelopes with any `type` other than `"intent"` are ignored silently.
- Keys `__proto__`, `constructor` and `prototype` reject the frame.
- `status` must be one of `pending | accepted | filled | failed`; `srcAmount`
  must be a decimal string (not a number); dates must be valid ISO strings;
  `version`, when present, must be a number.
- Unknown fields are stripped and all string fields pass through
  `sanitizeDisplayText`.
- Rejected frames are counted and the last 20 kept (truncated preview) for
  dev diagnostics (`getQuarantineDiagnostics()`); a rate-limited
  `secureLogger.warn` fires in development only. End users see nothing.

## Reconnect & Backfill (Assumed Relay Contract)

The relay does not replay missed frames. The client assumes:

- A reconnect may have missed any number of frames; after every transition to
  `open` following a disconnect, the REST snapshot for the active view is
  revalidated (deduplicated, at most once per 5 s, ignored after unmount).
- `version` (preferred) or `updatedAt`, when present, increase monotonically per
  intent; older frames are discarded. Without either, arrival order wins but
  status may never regress (`filled → pending` is rejected), which is
  clock-skew safe.
- If the relay later supports `?since=` / cursors, only the delta needs to be
  fetched; the store already merges partial snapshots without clearing rows.

## App-Wide Status-Change Alerts

`useIntentStatusWatcher` (`src/hooks/useIntentStatusWatcher.ts`), mounted via
`IntentStatusWatcher` in `src/app/layout.tsx`, subscribes to the same feed as
`useMyLiveIntents` but skips the REST snapshot fetch — it only diffs
`status` per intent `id` across incoming WebSocket messages, so it stays
cheap to run on every page. On a transition it pushes a toast (batched into
a single "N intents updated" toast when several land within the same
1-second window) linking to the intent, unless the user is already on
`/my-intents` where the transition is visible directly. State resets when
the connected wallet address changes. Browser `Notification` support was
scoped out of the initial pass — see issue #231 — since it requires an
explicit settings toggle to request permission.

## Per-Intent Live Updates (`useIntent`)

`useIntent` (`src/hooks/useIntent.ts`) provides live updates for a single intent
detail page using two complementary mechanisms:

1. **SWR polling** — `refreshInterval: 5_000` while the intent is non-terminal.
   Once `filled` or `failed` is observed the interval drops to `0`, stopping
   unnecessary requests automatically.

2. **WebSocket overlay** — subscribes to the same `NEXT_PUBLIC_WS_URL` feed as
   `useLiveIntents`. Because the backend broadcasts every status change as a
   `FeedItem`, filtering is done client-side by `id`. This gives sub-second
   updates when the socket is live, with polling as an automatic fallback.

**No new subscription shape is introduced** — the existing `FeedItem` message
format is reused. If the backend gains per-intent rooms in the future, the WS
URL passed to `useWebSocket` in `useIntent` can be changed to a targeted
endpoint without any changes to the broader protocol.

**Terminal state handling** — once `filled` or `failed` is observed (from either
the REST snapshot or a WS message), `useIntent` passes `null` to `useWebSocket`,
tearing down the socket subscription for that intent, and sets SWR's
`refreshInterval` to `0`.

## Backend Reference

If the canonical schema lives in [vortex-backend](https://github.com/vortex-protocol/vortex-backend),
link it here and keep the frontend types in sync. If the schema diverges, update the
`FeedItem` type in `src/lib/types.ts` and the corresponding tests in
`src/hooks/useLiveIntents.test.ts` and `src/hooks/useIntentFeed.test.ts`.

## Open-Intent Queue Events

The solver open-intents board (`useOpenIntentBoard`) listens on the same `NEXT_PUBLIC_WS_URL` socket for two additional message types; all other messages are ignored by it (and these are ignored by the feed consumers).

```ts
{ type: "intent.open";   intent: OpenIntent; serverTime?: string } // new or updated open intent
{ type: "intent.closed"; id: string;         serverTime?: string } // accepted, cancelled or expired
```

- Events are applied on top of the latest `/intents/open` REST snapshot; a fresh snapshot supersedes earlier events.
- `serverTime` (ISO 8601), when present, is used to compute a server clock offset so deadline countdowns tolerate local clock drift.
- If the relay does not emit these events the board still works from the 5 s REST poll.
