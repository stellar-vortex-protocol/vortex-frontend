# API Contract

All JSON API routes under `src/app/api/` share a common error convention.

## Error shape

Every error response is JSON with a single `error` field:

```json
{ "error": "<code>" }
```

Known error codes:

| Code              | Status | Meaning                                              |
| ----------------- | ------ | ---------------------------------------------------- |
| `invalid-address` | 400    | The `address` query parameter is missing or invalid. |
| `not-found`       | 404    | The requested resource does not exist upstream.      |
| `rate-limited`    | 429    | The caller exceeded the per-IP rate limit.           |
| `unavailable`     | 502    | The upstream service could not be reached.           |

## Rate limiting

Routes that proxy an upstream service use a per-IP token bucket. When the
bucket is empty the route responds with `429` and a `Retry-After` header
(seconds) indicating when the caller may retry.

## `GET /api/account-status`

Query: `address` (Stellar public key).

- `200` → `{ "funded": boolean }`
- `400` → `{ "error": "invalid-address" }`
- `429` → `{ "error": "rate-limited" }` with `Retry-After`
- `502` → `{ "error": "unavailable" }`

## `GET /api/federation`

Query: `address` (Stellar account address).

- `200` → `{ "address": string, "account_id": string }`
- `400` → `{ "error": "invalid-address" }`
- `404` → `{ "error": "not-found" }`
- `429` → `{ "error": "rate-limited" }` with `Retry-After`
- `502` → `{ "error": "unavailable" }`

Rate limit: 30-request burst, refilling at 1 request / 2 s per IP.
