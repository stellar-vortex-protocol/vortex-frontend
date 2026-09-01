## Summary

Four UX enhancements for the Vortex frontend, one commit each:

- **#298** – `Cmd/Ctrl+K` command palette for keyboard navigation
- **#299** – relative timestamps that stay current in live list views
- **#296** – printable / save-as-PDF summary on the intent detail page
- **#297** – "quote changed" delta indicator on the swap card

Closes #296
Closes #297
Closes #298
Closes #299

## Changes

### #298 – Command palette (`Cmd/Ctrl+K`)
- New `src/components/CommandPalette.tsx`: global `keydown` listener toggles a
  WAI-ARIA combobox/listbox modal. Navigates the four top-level routes; a pasted
  Stellar public key routes to `/solve/[address]`, any other whitespace-free
  token that matches no route is offered as an `/explore/[id]` lookup. Full
  keyboard operation (arrows wrap, `Enter` activates, `Esc`/backdrop close),
  focus is moved in on open and restored on close.
- Mounted once in `src/app/layout.tsx`.
- `src/components/CommandPalette.test.tsx` (8 cases), `e2e/command-palette.spec.ts`,
  and a `docs/components.md` entry.
- Strings are hard-coded English, matching the existing `ExplorePageClient`
  convention and avoiding edits to the (currently out-of-sync) i18n catalogs.

### #299 – Live relative timestamps
- New `src/hooks/useLiveRelativeTime.ts`: one shared 45s interval returning a
  `now` timestamp; pauses on `visibilitychange` (same pattern as `useWebSocket`)
  and clears on unmount. One interval per list, not one timer per row.
- Applied in `ActivityFeed.tsx`, `ExplorePageClient.tsx`, and `my-intents/page.tsx`
  (`timeAgo(iso, now)`), the latter gaining a "submitted … ago" line per row.
- `useLiveRelativeTime.test.ts` and `ExplorePageClient.test.tsx` (new), the
  latter asserting the label advances on its own as time passes.

### #296 – Printable intent record
- `explore/[id]/page.tsx`: a `print:hidden` "Print / Save as PDF" button calling
  `window.print()`; the summary card is wrapped as `#intent-record` with a
  print-only header; any non-`filled` intent shows a "not a completed-swap
  record" notice so a mid-flight print can't be mistaken for a receipt. The
  "Submitted" field now shows an absolute timestamp.
- New `@media print` block in `src/app/globals.css` strips `nav`/`footer` and
  interactive chrome and renders the record black-on-white.
- The status badge already carries a text label + distinct icon shape, so it
  stays legible in greyscale.

### #297 – Quote-change delta indicator
- `SwapCard.tsx` tracks the immediately-previous quote for the *same route*
  (chain + token pair) in a ref. When a fresh same-route quote moves the output
  amount or price impact, a small ▲/▼ badge (green = better for the user, amber =
  worse) shows next to that field and fades after 4s. No delta on the first
  quote for a route or after a token/route change.
- `SwapCard.delta.test.tsx` (new, 4 cases): improves / worsens / first-quote /
  route-change.
- Two missing catalog keys (`swap.quote.noSolver`, `swap.quote.highPriceImpactWarning`)
  added to `en`/`es`.

## Testing

- [ ] `npm run build` – **blocked by pre-existing breakage** (see below)
- [ ] `npx tsc --noEmit` – **blocked by pre-existing breakage** (see below)
- [x] New tests pass in isolation:
  - `CommandPalette.test.tsx` 8/8
  - `useLiveRelativeTime.test.ts` 3/3, `ExplorePageClient.test.tsx` 2/2
  - `explore/[id]/page.test.tsx` 11/11 (was 0/8), `my-intents/page.test.tsx` 18/19 (was 0/17)
  - `ActivityFeed.test.tsx` 10/10 (was 0/10)
  - `SwapCard.test.tsx` 14/14 (was 0/14, file didn't collect), `SwapCard.delta.test.tsx` 4/4
- [x] Full suite moved from **72 failed / 231 total** to **55 failed / 283 total**
  (52 new tests added, all green; 17 pre-existing failures fixed as a side effect
  of repairing files these features touch).

### Pre-existing breakage (not introduced here)

`main` does not build, typecheck, lint, or pass its own test suite at
`c87dc14`. Root cause: PRs #217/#218/#219 were merged with `Merge branch main
into feature/…` conflict resolutions that kept both sides, leaving duplicate
declarations, half-applied features, and test files from divergent branches.

To ship these four features the following files had to be repaired **just enough
to compile and render** (their existing test suites are exercised above):

- `src/components/SwapCard.tsx` – had ~42 type errors (duplicate `chainPickerRef`/
  `chainToggleRef`/`closeChainPicker`/`useEffect`; undefined `dstAddress`,
  `slippagePct`, `quoteFetchedAt`, `STALE_QUOTE_THRESHOLD_MS`, `quoteErrorType`).
  The dropped slippage-tolerance field + min-out line were restored (both have
  `en`/`es` keys and are required by the existing `SwapCard.test.tsx`); the
  amount input is now `type="text" inputMode="decimal"` so 18-dp values aren't
  reformatted.
- `src/components/ActivityFeed.tsx` – duplicate `export`, undefined
  `useTranslation`/`announcement`/`FeedSkeleton`/`ActivityFeedView`; rebuilt
  without i18n (matching `ExplorePageClient`) and with the debounced live-region
  announcement its test expects.
- `src/app/explore/[id]/page.tsx` – `CopyButton`/`copy`/`copied` undefined.
- `src/app/my-intents/page.tsx` – `downloadCsv`/`buildIntentsCsv` not imported,
  duplicate status badge, over-riding `aria-label`s.

Still red and **left untouched** (out of scope): the 3 files with unresolved
merge-conflict markers that block a full `tsc`/`build`
(`src/app/explore/page.tsx`, `src/app/solve/page.tsx`,
`src/app/solve/[address]/page.test.tsx`); `Nav.tsx` / `ConnectWalletButton.tsx` /
`wallet.ts` (mocked in the touched test suites); the i18n catalog key-parity
gap; `*.stories.tsx`. `my-intents/page.test.tsx`'s "retry button" case references
undefined `user`/`mutateMock` in the test body and cannot pass without a test
rewrite.

Print-preview screenshots for #296 could not be captured because the app does
not currently run; the print trigger is covered by a mocked `window.print` test.

## Checklist

- [x] Self-reviewed the diff
- [x] Added or updated tests for new behaviour
- [x] No secrets or credentials committed
- [x] PR title follows conventional commits
