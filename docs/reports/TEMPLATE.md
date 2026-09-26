# State of the Protocol — {YYYY} Q{N}

> Period: {start date} – {end date}. Data as of {date compiled}.
> Copy this file to `docs/reports/{yyyy}-q{n}.md` and fill every section from the
> sources named in it. Where a source has no data yet, say so — don't estimate.

## Summary

Two or three sentences a community member can read on their own: what shipped,
what the protocol did, and anything that needs attention.

## Protocol activity

**Source:** the [`/analytics`](../../src/app/analytics/AnalyticsPageClient.tsx) view
(computed client-side from the relay's tracked intents — note its window, e.g.
"based on the last 200 tracked intents"). If the relay has no public data yet,
write that instead of a table.

| Metric | This quarter | Notes |
|---|---|---|
| Intents created | | |
| Intents filled | | Fill rate: |
| Volume (USD) | | |
| Active solvers | | |
| Median fill time | | |

## Notable shipped changes

**Sources:** [`CHANGELOG.md`](../../CHANGELOG.md) and PRs merged in the period
(`gh pr list --state merged --search "merged:{start}..{end}"`). Group by theme,
link PR numbers, and keep each line to what a user or contributor would notice.

- **{Theme}** — {change} (#{PR})

## Governance

**Source:** [`/governance`](../../src/app/governance/GovernancePageClient.tsx)
proposals. List each proposal opened or decided in the period with its outcome.
If governance is still running on placeholder data, say so.

| Proposal | Status | Outcome / note |
|---|---|---|

## Contributor activity

**Source:** GitHub (merged PRs, distinct PR authors, issues opened/closed in the
period).

| Metric | This quarter |
|---|---|
| PRs merged | |
| Distinct PR authors | |
| Issues opened / closed | |

## Health and known issues

Anything the community should know is broken, degraded or blocked (link the
tracking issues), plus data-quality caveats for this report.

## Next quarter

What is planned or in flight, from the [README roadmap](../../README.md#roadmap)
and open issues.
