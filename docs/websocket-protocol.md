# WebSocket Protocol

## Overview

The frontend connects to a WebSocket endpoint defined by `NEXT_PUBLIC_WS_URL`. The generic
`useWebSocket<T>` hook (`src/hooks/useWebSocket.ts`) manages the connection, auto-reconnect, and
JSON parsing. Each frame is expected to be a JSON object matched to the generic type `T`.

**Connection behavior:**
- Reconnect delay: 3 seconds
- Malformed frames are silently ignored
- Passing `null` as the URL tears down the socket and stays idle

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

| Field | Type | Notes |
|-------|------|-------|
| `id` | `string` | Unique intent identifier |
| `srcChain` | `string` | Source chain identifier |
| `srcToken` | `string` | Source asset symbol |
| `srcAmount` | `string` | Human-readable amount |
| `dstToken` | `string` | Destination asset symbol |
| `solver` | `string` | Solver name or address |
| `status` | `string` | Enum: `pending`, `accepted`, `filled`, `failed` |
| `createdAt` | `string` | ISO-8601 UTC timestamp |

## Backend Reference

If the canonical schema lives in [vortex-backend](https://github.com/vortex-protocol/vortex-backend),
link it here and keep the frontend types in sync. If the schema diverges, update the
`FeedItem` type in `src/lib/types.ts` and the corresponding tests in
`src/hooks/useLiveIntents.test.ts` and `src/hooks/useIntentFeed.test.ts`.
