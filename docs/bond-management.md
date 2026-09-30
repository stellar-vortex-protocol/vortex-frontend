# Solver bond management (`/solve/manage`)

Connected solvers can view their bond, top it up, and request withdrawals. Withdrawals go through a cooldown
before the funds can be claimed.

## Feature flag

`NEXT_PUBLIC_FEATURE_BOND_MGMT` controls the page:

| Value | Behaviour |
| --- | --- |
| unset / anything else | Route returns 404 |
| `mock` | In-memory mock adapter (`mockBondAdapter`), no wallet signature; for UI work before the API exists |
| `1` / `true` | Live HTTP adapter against `NEXT_PUBLIC_API_URL` |

Rollout plan: keep the flag unset in production, use `mock` in preview/staging until the relay ships the
endpoints below, then switch staging to `1`, verify against testnet, and enable in production. A link from the
solver portal can be added once the flag is on by default.

> The issue suggested an MSW mock. MSW is not a dependency of this repo yet, so the mock is a typed in-memory
> adapter that implements the same `BondAdapter` interface. Swapping it for MSW handlers later needs no UI
> changes.

## Assumed API contract

All amounts are decimal strings in USDC with up to 7 decimal places. The UI parses them to integer stroops
(`src/lib/decimal.ts`) and never uses floats.

```
GET  /solvers/:address/bond
  200 BondState { address, bond, locked, available, minimumBond, cooldownSeconds,
                  pendingWithdrawals: [{ id, amount, requestedAt, availableAt }] }
  404 not a registered solver

POST /solvers/:address/bond/top-ups        { amount } → 200 { operationId, unsignedXdr }
POST /solvers/:address/bond/withdrawals    { amount } → 200 { operationId, unsignedXdr }
  400/422 amount invalid, exceeds available, or exceeds the maximum

POST /solvers/:address/bond/operations/:operationId/submit   { signedXdr } → 200 BondState
```

The server returns simulated, unsigned XDR. The client decodes and reviews it with `decodeXdr`, has the user
sign it in Freighter, then submits it. The UI applies the expected state optimistically, then replaces it
with the returned `BondState`, or rolls back if the call fails. The page also polls every 30 s, which picks
up changes from other tabs and from partial fills that change `locked`.

## Validation and warnings

- Amounts must be positive, have at most 7 decimal places, and be at most 1,000,000 for a top-up or at most
  `available` for a withdrawal.
- If a withdrawal would leave `bond − pending withdrawals` under `minimumBond`, the UI shows a warning and
  submission needs an explicit checkbox. The solver becomes inactive.
- Actions are disabled if the connected wallet is on the wrong network. The hook refuses to act if the
  wallet address doesn't match the solver address.
- Pending withdrawals count down every second and switch to "Ready to claim" while the page is open.
