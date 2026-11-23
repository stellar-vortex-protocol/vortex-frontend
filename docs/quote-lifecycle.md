# Quote lifecycle

The quote lifecycle is driven by the transaction flow machine in
`src/lib/flow/machine.ts`. The states below are the machine's state union; the
transitions are the machine's events. Do not document states or transitions
that are not in the machine.

## States

| State | Meaning |
| --- | --- |
| `idle` | No quote loaded yet. |
| `quoting` | A quote is being fetched. |
| `quoted` | A quote is loaded and valid. |
| `refreshing` | The loaded quote is being refreshed. |
| `expired` | The quote has expired and must be refreshed before use. |
| `locked` | The quote is locked for signing; refreshes stop and the relay XDR is checked against this snapshot. |
| `signing` | The locked quote is being signed. |
| `submitted` | The signed transaction has been submitted. |
| `confirmed` | The transaction is confirmed on-chain. |
| `failed` | The flow ended in an error (see `src/lib/flow/errors.ts`). |

## Transitions

| From | Event | To |
| --- | --- | --- |
| `idle` | `QUOTE_REQUESTED` | `quoting` |
| `quoting` | `QUOTE_RECEIVED` | `quoted` |
| `quoting` | `QUOTE_FAILED` | `failed` |
| `quoted` | `REFRESH_REQUESTED` | `refreshing` |
| `quoted` | `QUOTE_EXPIRED` | `expired` |
| `quoted` | `LOCK_REQUESTED` | `locked` |
| `refreshing` | `QUOTE_RECEIVED` | `quoted` |
| `refreshing` | `QUOTE_FAILED` | `failed` |
| `expired` | `REFRESH_REQUESTED` | `refreshing` |
| `locked` | `SIGN_REQUESTED` | `signing` |
| `signing` | `SIGNATURE_RECEIVED` | `submitted` |
| `signing` | `SIGN_FAILED` | `failed` |
| `submitted` | `TX_CONFIRMED` | `confirmed` |
| `submitted` | `TX_FAILED` | `failed` |

## Errors

Error states are defined in `src/lib/flow/errors.ts` and surface through the
`failed` state. The docs should reference those error codes rather than
inventing new states.

## Hooks

`useQuote` exposes `phase`, `expiresAt`, `secondsRemaining`, `refreshQuote`,
and `lockQuote`. Refresh is paused while the tab is hidden or offline and is
triggered immediately on focus/online. Relay-provided `expiresAt` wins over
the local TTL to tolerate clock skew.
