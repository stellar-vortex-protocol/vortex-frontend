# Error Monitoring

This page describes how errors are surfaced and reported in the app. It is
kept in sync with the actual error boundary files and reporting call sites.

## Error boundaries

Next.js App Router error boundaries live next to the routes they protect. Each
one is a client component that receives `{ error, reset }` and renders a
recoverable fallback. The boundaries in this repo are:

| File | Scope |
| --- | --- |
| `src/app/error.tsx` | Root app segment (catches errors from all routes below it) |
| `src/app/explore/error.tsx` | `/explore` listing |
| `src/app/explore/[id]/error.tsx` | `/explore/[id]` intent detail |
| `src/app/governance/error.tsx` | `/governance` |
| `src/app/my-intents/error.tsx` | `/my-intents` |
| `src/app/solve/error.tsx` | `/solve` listing |
| `src/app/solve/[address]/error.tsx` | `/solve/[address]` solver detail |

Each boundary renders a fallback with a retry action wired to `reset()`. They
do not send errors to an external reporting service; there is no third-party
error-tracking integration in these files. If you add one, update this page and
the boundary files together.

## Transaction error taxonomy

Transaction flows classify failures with `classifyFlowError` in
`src/lib/flow/errors.ts`. It maps a thrown value to a `FlowErrorKind`:

- `network` — timeouts and fetch failures (`TimeoutError`, `failed to fetch`).
- `user-rejected` — wallet rejections (`WalletError` with kind `user-rejected`)
  and messages containing denied/rejected/declined/cancelled.
- `balance` — 400/422 responses mentioning balance, insufficient, or funds.
- `no-solver` — 409 responses or messages mentioning no solver.
- `validation` — `XdrMismatchError` and `ValidationError`.
- `generic` — anything else.

`FLOW_ERROR_GUIDANCE_KEY` and `FLOW_ERROR_GUIDANCE` provide the one-line
user-facing guidance for each kind (`generic` has none). The raw error message
is always preserved alongside the kind so no backend detail is lost.
