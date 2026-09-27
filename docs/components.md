# Shared Component Usage

Short usage docs for the components under `src/components/` that other
contributors are most likely to reuse. Keep these in sync with the actual props
if they change.

## `IntentStatusBadge`

[`src/components/IntentStatusBadge.tsx`](../src/components/IntentStatusBadge.tsx)

Renders a pill badge for an intent's lifecycle status, with a distinct icon per
status (not just color) so it doesn't rely on color alone to differentiate.

```tsx
import { IntentStatusBadge } from "@/components/IntentStatusBadge";

<IntentStatusBadge status="filled" />;
```

**Props**

| prop     | type           | required | notes                                                                          |
| -------- | -------------- | -------- | ------------------------------------------------------------------------------ |
| `status` | `IntentStatus` | yes      | one of `"pending" \| "accepted" \| "filled" \| "failed"` (see `src/lib/types`) |

No other configuration — styling and icon are derived entirely from `status` via
the internal `STATUS_STYLES` / `STATUS_ICONS` maps. To support a new status,
add an entry to both maps and to the `IntentStatus` type.

## `ToastViewport`

[`src/components/ToastViewport.tsx`](../src/components/ToastViewport.tsx)

Fixed-position (bottom-right) container that renders the current toast queue
from [`useToastStore`](../src/store/toast.ts) and handles dismissal. See
[`docs/toast-system.md`](./toast-system.md) for the full API on how to push
toasts.

```tsx
import { ToastViewport } from "@/components/ToastViewport";

<ToastViewport />;
```

**Props**: none. Mount it once, near the root of the tree — it's already mounted
in [`src/app/layout.tsx`](../src/app/layout.tsx), so you should not need to mount
it again in a page or feature component. It renders `null` when there are no
active toasts.

## `ConnectWalletButton`

[`src/components/ConnectWalletButton.tsx`](../src/components/ConnectWalletButton.tsx)

Self-contained wallet connect/disconnect button. Reads and drives
[`useWalletStore`](../src/store/wallet.ts) directly — no props are needed to wire
it up to wallet state.

```tsx
import { ConnectWalletButton } from "@/components/ConnectWalletButton";

<ConnectWalletButton />
<ConnectWalletButton compact />
```

**Props**

| prop      | type      | required | default | notes                                                                  |
| --------- | --------- | -------- | ------- | ---------------------------------------------------------------------- |
| `compact` | `boolean` | no       | `false` | tighter padding/layout for constrained spaces (e.g. mobile nav/header) |

**Behavior**

- Not connected: shows "Connect Freighter" (or "Retry Connection" if a previous
  attempt errored, with the error message as the `title` tooltip). Disabled with
  a "Connecting..." label while `isConnecting`.
- Connected: shows the truncated address, swapping to "Disconnect" on hover/focus.
- On a failed `connect()` call, it also pushes an error toast via
  [`useToastStore`](../src/store/toast.ts) — you don't need to handle connection
  errors yourself when using this component.

## `Tooltip`

[`src/components/Tooltip.tsx`](../src/components/Tooltip.tsx)

Accessible WAI-ARIA tooltip component. Shown on hover and keyboard focus
(never mouse-only), dismissed via Escape, and associated to its trigger via
`aria-describedby`. Includes basic viewport-edge collision handling and a
tap-to-toggle affordance for touch devices.

```tsx
import { Tooltip } from "@/components/Tooltip";

<Tooltip content="Protocol fee is deducted from the destination amount.">
  <span className="underline decoration-dotted cursor-help">Protocol fee</span>
</Tooltip>
```

**Props**

| prop        | type        | required | default  | notes                                                                                |
| ----------- | ----------- | -------- | -------- | ------------------------------------------------------------------------------------ |
| `content`   | `ReactNode` | yes      | —        | The tooltip text or element shown in the popover.                                    |
| `children`  | `ReactElement` | yes   | —        | Single trigger element. Must accept `ref`, `aria-describedby`, focus/blur/mouse handlers. |
| `placement` | `"top" \| "bottom"` | no | `"top"` | Preferred placement; auto-flips when close to viewport edge.                        |

**Behaviour**

- Hover or keyboard focus opens the tooltip; losing either closes it.
- Pressing Escape dismisses the tooltip from anywhere on the page.
- Touch: tap the trigger to toggle the tooltip open/closed.
- The trigger receives `aria-describedby` pointing to the tooltip while it is visible.
- Does not trap focus or interfere with Tab order.
- Currently applied to `Price impact`, `Protocol fee`, and `Est. fill time` in
  SwapCard's quote details panel. See `Tooltip.stories.tsx` for interactive examples.


## `DataTable`

Generic accessible table (`src/components/DataTable.tsx`), first used by the solver leaderboard.

- Real `<table>` with a screen-reader caption, `scope`d headers, a row header per row and `aria-sort` on the primary sorted column.
- Sort buttons in headers: click = single sort (asc → desc → cleared), **shift-click / Shift+Enter / Shift+Space** = add a secondary key. Sort state is owned by the caller (`sorts` / `onSort`), so it can live in the URL.
- Sticky header; below 640 px each row collapses into a labelled card via CSS (`data-label`), keeping a single DOM.
- More than `virtualizeAbove` (default 200) rows are windowed with `@tanstack/react-virtual`.
- Story: `DataTable.stories.tsx` (ties, zero fills, spoofing characters, 500 rows, mobile).

## Solver portal (`/solve`)

All portal state is URL-synced (`useQueryState`) so views are shareable and the back button works.

- **`SolverLeaderboard`** — ranking from `rankSolvers()` (`src/lib/solverRanking.ts`): volume → fills → success rate → avg fill time → address (stable tiebreak); success rate is recomputed from fills/failed and is 0 for solvers without attempts. Time windows `24h | 7d | 30d | all` read `GET /solvers?window=…` (the relay aggregates per window). Rank deltas use the relay's `previousRank` when present, otherwise a snapshot persisted in `localStorage` per window. Filters: chain, status, min bond, verified-only. Column visibility via `useColumnVisibility`. CSV export of the visible rows/columns through the injection-safe `buildCsv`. URL keys: `window`, `sort` (`key:dir,…`), `chain`, `status`, `minBond`, `verified`.
- **`OpenIntentsBoard`** — `useOpenIntentBoard` merges the `/intents/open` REST snapshot with `intent.open` / `intent.closed` WebSocket events (see `websocket-protocol.md`). Sorted by soonest deadline; countdowns use `formatTimeRemaining` and turn urgent under 60 s; Accept is disabled once expired, on a network mismatch, or when the connected wallet is not a registered solver. Accept outcomes drive a per-row state machine (`rowReducer`): 409 → "Taken by another solver" (announced, removed after 3 s), 410/expired → explanatory state, success → "Accepted by you". While the pointer or focus is inside the list, updates are buffered (no jumping rows) and offered via a "show N updates" button. URL keys: `ichain`, `itoken`, `minUsd`, `density`.
  - *Performance (200 rows):* one shared 1 s ticker (`useNow`, `useSyncExternalStore`) drives every countdown instead of a timer per row, filtering/sorting is memoised, and a tick only changes countdown text, so 200 rows cost one interval and one list re-render per second (no per-row effects). If profiling shows otherwise at larger sizes, the list can adopt the same virtualisation as `DataTable`.
- **`RegistrationWizard`** — steps *eligibility → verify address → bond → review & sign → done* driven by the pure `wizardReducer` with per-step validators (`src/lib/registrationWizard.ts`). Eligibility checks (wallet, network, valid address, not already registered, account funded via the `/api/account-status` Horizon proxy — cancelable) each show pass/fail/pending plus remediation text. Bond maths uses 7-decimal integer (BigInt) units; minimum, suggestions and the unbonding period come from `SOLVER_BOND_CONFIG`. Progress is saved per wallet with a 24 h TTL (`useLocalStorageDraft`) and restored only through an explicit "Resume registration" banner; switching wallets mid-flow resets with a notice; a draft whose bond is now below the minimum is sent back to the bond step. The step is mirrored in `?step=` so the browser back button moves between steps.
- **`SolverBadge` / `SolverIdentityChip`** — optional stellar.toml identity chip (`verified | unverified | mismatch | unavailable`) with icon + text + tooltip (never colour-only). Display only — see the threat model in `security-audit.md`.
