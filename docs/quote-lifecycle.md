# Quote lifecycle

```text
fresh ──(age / refresh margin)──> aging ──(expiry)──> stale
  ▲                                  │                  │
  └──────── successful refresh ◄─────┴──── refreshing ◄──┘

confirm/sign ──> locked-for-signing (refreshes stop; relay XDR is checked against this snapshot)
```

`useQuote` exposes `phase`, `expiresAt`, `secondsRemaining`, `refreshQuote`,
and `lockQuote`. Refresh is paused while the tab is hidden or offline and is
triggered immediately on focus/online. Relay-provided `expiresAt` wins over
the local TTL to tolerate clock skew.
