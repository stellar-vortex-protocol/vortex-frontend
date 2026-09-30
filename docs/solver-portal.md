# Solver portal

Pages and pure metric modules used by solvers and by users who vet solvers.

| Route | Purpose |
| --- | --- |
| `/solve/[address]` | Public solver profile: 7/30/90 d performance panels, chain × token coverage, paginated fill history with a status filter, the weekly `SolverTimeline` sparkline, and the penalty summary and feed. |
| `/solve/dashboard` | "My solver" view for the connected wallet. |
| `/solve/compare?a=&b=&c=` | Up to three solvers side by side. |

## Metrics (`src/lib/solverStats.ts`, `src/lib/solverDashboard.ts`)

All metrics are pure functions over validated `FeedItem`/`Solver` data, so they can be unit tested without rendering.

- **Timezone policy:** every day, ISO week and window boundary is computed in **UTC**. Results don't depend on the viewer's locale or on DST.
- **ISO weeks:** `isoWeekKey` follows ISO 8601: weeks start on Monday, and week 1 is the week that contains the year's first Thursday. So 2021-01-01 falls in `2020-W53`, and 2024-12-30 falls in `2025-W01`. The previous day-of-year ÷ 7 approximation was replaced.
- `computeSolverStats(fills, window)`: totals, success rate (`filled / (filled + failed)`) and a zero-filled series. The series uses daily buckets for 7 and 30 days, and weekly buckets for 90 days. With fewer than 5 fills in the window, `insufficientData` is set and the charts are replaced by an explicit message.
- **Average fill time:** only the relay's all-time aggregate (`Solver.avgFillTimeSeconds`) is available. A per-window value needs server aggregation, which is out of scope.
- **Charts:** `components/charts/BarChart` renders a decorative SVG. The values are always available in a data table, which assistive tech can read and sighted users can toggle.

## Dashboard

- **Gating:**
  - No wallet connected: a connect prompt.
  - `/solvers/:address` returns 404: onboarding with a link to registration.
  - Otherwise: the dashboard panels.
- **Bond health:** `bond / 50 USDC minimum`. The status is *critical* below 1×, *warning* below 1.5×, and *healthy* otherwise.
- **Estimated fee earnings:** for each `filled` intent, `srcAmount × SOLVER_FEE_BPS (10) / 10 000`, summed per source token. The arithmetic uses 7-decimal fixed-point `BigInt`, so large amounts never lose precision.
- **Preferences:**
  - "Hide balances" blurs sensitive values.
  - "Notify on expiry" raises a toast when an accepted intent has less than 5 minutes left.
  - Both are stored only in `localStorage`. No data leaves the browser beyond the normal API calls.
- **Addresses:** compared case-insensitively (`normalizeAddress`).

## Compare

- **Selection:** checkboxes on the leaderboard, up to 3. Trying to select a 4th solver is announced through a live region.
- **URL:** the URL is the source of truth. `parseCompareParams` keeps only valid strkeys, removes duplicates and caps the list at 3. Invalid values are reported, and solvers missing from `/solvers` render as "Solver not found".
- **Best/worst:** `compareSolvers` returns best/worst indexes per metric. They're marked with ▲/▼ plus text, not colour alone. Nothing is marked when all values are equal.

## Penalty (slash) events

Assumed relay contract (not yet implemented server side):

```
GET /slash-events?solver=<G…>&cursor=<opaque>
→ { "events": SlashEvent[], "nextCursor": string | null }

SlashEvent {
  id: string
  solver: string            // G… strkey
  reasonCode: string        // missed_deadline | invalid_fill | downtime | double_accept | <future codes>
  amountUsd: string         // decimal string
  resultingBondUsd: string  // decimal string
  intentId: string | null
  createdAt: string         // ISO 8601
}
```

- **Validation:** `isSlashEvent` / `isSlashEventPage` validate every response. Events are de-duplicated and sorted newest first, because they may arrive out of order.
- **Reason codes:** codes map to i18n keys through `REASON_REGISTRY`. An unknown code falls back to a generic message, and the raw code stays visible for support.
- **Mock data:** set `NEXT_PUBLIC_SLASH_EVENTS_MOCK=true` to serve deterministic mock pages until the endpoint exists.
- **Live updates:** `useSlashEvents` revalidates every loaded page every 30 s.
