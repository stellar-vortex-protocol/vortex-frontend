# Data fetching policy

All REST reads go through SWR with a single global policy set by
`AppSWRProvider` (`src/components/AppSWRProvider.tsx`, mounted in the root
layout). Policy code lives in `src/lib/swrPolicy.ts`.

## Global defaults

| Option | Value | Why |
| --- | --- | --- |
| `onErrorRetry` | up to 4 retries, exponential backoff with jitter (1 s → 30 s cap) | Avoids hammering a struggling relay |
| Retryable errors | network, timeout, 5xx, 408, 429 | Other 4xx and validation errors will not self-heal |
| `Retry-After` | honoured (seconds or HTTP date), capped at 30 s | Respect server back-pressure |
| `isPaused` | `true` while `useConnectivity()` reports offline | No spinning on offline devices; `useConnectivity` revalidates everything on reconnect |
| `dedupingInterval` | 5 s | Collapses re-mounts into one request |
| `revalidateOnFocus` | on, throttled to 30 s | Fresh data after tab switches without focus storms |

Aborted requests (`AbortError`) are never retried or surfaced as errors.
Hooks may override any option locally (e.g. `useQuote` keeps its own
`onErrorRetry`); overrides must be commented with a rationale.

In development a middleware counts fetches per key and warns via
`secureLogger` when a key is refetched unusually often (over-fetch detector).

## Per-endpoint refresh intervals

| Hook | Endpoint | `refreshInterval` | Rationale |
| --- | --- | --- | --- |
| `useIntents` / `useIntentsPage` | `/intents` | 0 | Live updates arrive over the WebSocket |
| `useActivityFeed` | `/intents/feed` | 0 | WebSocket-driven (`useIntentFeed`) |
| `useMyIntents` | `/intents?address=` | 0 | Status changes arrive via the watcher/WebSocket |
| `useIntent` | `/intents/:id` | 0 | Revalidates on focus; detail is mostly static |
| `useOpenIntents` | `/intents/open` | 5 s | Solvers need near-real-time open intents |
| `useSolvers` | `/solvers` | 30 s | Leaderboard changes slowly |
| `useSolver` | `/solvers/:address` | 0 | Revalidates on focus |
| `useQuote` | `/quote?…` | 0 | Re-fetched when inputs change; quotes expire client-side |

## Errors

`toClientError()` in `src/lib/api.ts` normalises any thrown value to a
`ClientError` with `kind: "network" | "timeout" | "http" | "validation"`.
Components render failures with `<ErrorState error retry />`, which shows a
localised message (`error.*` i18n keys) and a copyable request id.

## Response validation

Every fetcher is created with `endpoint(schema)` so hooks cannot fetch
unvalidated data. Schemas in `src/lib/schemas.ts` are built from small
combinators (`object`, `listOf`, `numericStr`, `isoDate`, `strkey`, …) and throw
`ValidationError` with the path of the first failing field (e.g.
`$[3].createdAt`). Lists drop invalid items with a redacted warning;
`setStrictValidation(true)` makes them throw instead (tests). Unknown fields
are allowed for forward compatibility. Shared fixtures live in
`src/test/fixtures`.

## Intent pagination

`useIntentsPage({ filters, sort })` uses `useSWRInfinite`.

**API assumption:** `GET /intents?limit=<n>&cursor=<c>&status=&chain=&sort=`
returns `{ items: FeedItem[], nextCursor: string | null }`. A `null`/missing
`nextCursor` ends pagination.

**Compatibility shim:** until the backend ships pagination, the current bare
`FeedItem[]` response is accepted by `intentsPageSchema` as a single, final
page, and Explore keeps filtering client-side.

**Shim removal plan:** once the relay returns the paginated shape in all
environments, (1) remove the `Array.isArray` branch in `intentsPageSchema`,
(2) drop client-side status/chain filtering in `ExplorePageClient`, and
(3) delete `useLiveIntents`' 200-item snapshot path once analytics moves to a
dedicated endpoint.

Changing filters resets the cursor and aborts in-flight page loads. Live
WebSocket items are merged on top (`useLiveIntentsPage`) and skipped when the
same id already exists in a loaded page. A failed page keeps loaded pages and
offers a retry in the list footer.
