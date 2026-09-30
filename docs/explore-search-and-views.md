# Explore search, saved views and intent detail

## Search syntax (#441)

The Explore search box accepts free text plus structured tokens:

| Token            | Example          | Effect                                   |
| ---------------- | ---------------- | ---------------------------------------- |
| free text        | `abc123`         | Matches id, tokens, chain, solver, status |
| `status:<value>` | `status:filled`  | `pending`, `accepted`, `filled`, `failed` |
| `chain:<id>`     | `chain:base`     | Any chain id from `CHAINS`               |
| `token:<symbol>` | `token:USDC`     | Source or destination token              |
| `"phrase"`       | `"alpha market"` | Keeps spaces inside one term             |

- Every term must match (AND). Matching is plain substring matching on
  sanitised fields; no regular expression is ever built from user input.
- Unknown keys (`foo:bar`) and invalid values (`status:bogus`) are treated as
  free text. The value is everything after the first colon.
- Queries are capped at 200 characters, and bidi/zero-width characters are
  stripped.
- The query is kept in `?q=` and written with a debounced `router.replace`,
  so typing doesn't add history entries.
- Suggestions use the WAI-ARIA combobox pattern: arrow keys move, Enter
  accepts, and Escape closes the list (a second Escape clears the input).
  Recent searches are persisted (up to 8, synced across tabs) and can be
  cleared from the `?` help popover.
- The relay has no server-side search yet, so filtering runs on the loaded
  results and the UI says so.

The parser and URL readers live in `src/lib/searchQuery.ts` and are the single
source of truth for `status`, `chain`, `sort`, `range` and `q`.

## Saved views (#442)

A view is `{ id, name, scope, params }`, where `params` holds the page's URL
state. Views are stored in `src/store/views.ts` (versioned through
`createSyncedPersist`, synced across tabs, max 20).

- Built-in read-only views: **Failed last 7 days** and **Large fills**.
- Rename, delete and reorder (↑/↓ buttons) all work from the keyboard.
- Params are validated by the same readers as the URL. Unknown keys or values
  that no longer parse (for example a removed chain) are dropped, and the
  page shows a notice. Corrupted stored entries are dropped on load.
- Names are sanitised (bidi and zero-width characters stripped, 40-character
  cap) and rendered as text. Name collisions get " (2)", " (3)" and so on.
- **Share** copies a URL containing only the validated params. Stellar
  addresses are stripped from shared and saved queries. Opening a shared URL
  applies the filters and does not change anyone's saved views.
- On My Intents, filters live in local state, so a shared URL is read once on
  mount.

## Intent detail (#443)

`/explore/[id]` shows:

- A timeline (created → accepted → submitted → filled/failed) built by the
  pure `buildTimeline()` in `src/lib/timeline.ts`. Each step shows absolute and
  live relative times plus the time since the previous step. Missing
  timestamps are labelled rather than guessed, and steps skipped by an early
  failure are marked as skipped.
- Explorer links from `explorerUrl()` in `src/lib/explorerLinks.ts`, based on
  `NEXT_PUBLIC_NETWORK`. An unknown network or a malformed identifier renders
  as plain text. Links use `rel="noopener noreferrer"`.
- **Copy details** (a readable summary) and **Copy JSON** (only for a payload
  that passes `isIntentDetail`). Both go through `redactForExport`, which drops
  any XDR, signature or secret keys.
- A collapsible, read-only JSON inspector. It renders text nodes only (no
  `dangerouslySetInnerHTML`), strips bidi and zero-width characters, and shows
  large objects 50 entries at a time.
