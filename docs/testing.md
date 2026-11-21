# Testing Conventions

## Tooling

CI enforces the per-directory V8 coverage floors in `vitest.config.ts` and a
coverage ratchet that rejects decreases greater than 0.5 percentage points.
Run `npm run check:orphan-tests` to catch test-like files Vitest will not
discover, and `npm run check:docs` validates documented source paths.

- **Test runner:** Vitest (`npm run test`, `npm run test:coverage`)
- **Environment:** jsdom (`vitest.config.ts`)
- **Assertions & helpers:** `@testing-library/react`, `@testing-library/user-event`, `@testing-library/jest-dom`
- **Config:** `vitest.setup.ts` imports `@testing-library/jest-dom/vitest`
- **Path alias:** `@` resolves to `src/`

## File Layout

Test files live next to the source they exercise:

| Source                                             | Test                                          |
| -------------------------------------------------- | --------------------------------------------- |
| `src/hooks/useDebouncedValue.ts`                   | `src/hooks/useDebouncedValue.test.ts`         |
| `src/hooks/useLiveIntents.ts`                      | `src/hooks/useLiveIntents.test.ts`            |
| `src/components/ConnectWalletButton.tsx`           | `src/components/ConnectWalletButton.test.tsx` |
| `src/app/explore/[id]/page.tsx`                    | `src/app/explore/[id]/page.test.tsx`          |
| `src/store/wallet.ts`                              | `src/store/wallet.test.ts`                    |
| `src/app/solve/accept-intent.integration.test.tsx` | co-located under the page dir                 |

## Naming

- Hook/unit tests: `<name>.test.ts` or `<name>.test.tsx`
- Integration tests: `<feature>.integration.test.tsx`

## Mocking Patterns

### Custom hooks

Hoist mocks with `vi.hoisted`, then `vi.mock` the module path.

**Reference:** `src/hooks/useLiveIntents.test.ts:18-24`

```ts
const { useIntentsMock, useWebSocketMock } = vi.hoisted(() => ({
  useIntentsMock: vi.fn(),
  useWebSocketMock: vi.fn(),
}));

vi.mock("./useIntents", () => ({ useIntents: useIntentsMock }));
vi.mock("./useWebSocket", () => ({ useWebSocket: useWebSocketMock }));
```

### SWR / global fetch

Either stub global fetch or wrap with `SWRConfig`.

**Reference:** `src/hooks/useActivityFeed.test.tsx`

```ts
vi.stubGlobal("fetch", vi.fn());
// or
const wrapper = ({ children }) => (
  <SWRConfig value={{ provider: () => new Map(), dedupingInterval: 0 }}>{children}</SWRConfig>
);
```

### Zustand stores

Freeze initial state, reset in `beforeEach`/`afterEach`, and restore after each test.

**Reference:** `src/store/wallet.test.ts:23-33`

```ts
const initialState = useWalletStore.getState();

describe("useWalletStore", () => {
  beforeEach(() => {
    useWalletStore.setState(initialState, true);
    vi.clearAllMocks();
  });

  afterEach(() => {
    useWalletStore.setState(initialState, true);
  });
});
```

For component tests, expose a minimal `getState` when only one method is needed.

**Reference:** `src/components/ConnectWalletButton.test.tsx:20-22`

```ts
vi.mock("@/store/toast", () => ({
  useToastStore: { getState: () => ({ addToast: addToastMock }) },
}));
```

### External modules (`@stellar/freighter-api`)

Hoist all mocks, then replace the module with a stub.

**Reference:** `src/store/wallet.test.ts:3-19`, `src/components/ConnectWalletButton.test.tsx:5-18`

```ts
const { isConnectedMock, requestAccessMock } = vi.hoisted(() => ({
  isConnectedMock: vi.fn(),
  requestAccessMock: vi.fn(),
}));

vi.mock("@stellar/freighter-api", () => ({
  default: {
    isConnected: isConnectedMock,
    requestAccess: requestAccessMock,
  },
}));
```

## Testing Helpers

- `renderHook` for hooks: `src/hooks/useDebouncedValue.test.ts`
- `userEvent.setup()` for interactions: `src/components/ConnectWalletButton.test.tsx:49`
- `waitFor` for async updates: `src/components/ConnectWalletButton.test.tsx:54`
- `vi.useFakeTimers()` + `act` for timers: `src/hooks/useDebouncedValue.test.ts:6-12`

## Page / Component Tests

- Mock the data hooks the page depends on
- Assert loading, error, empty, and success states
- Use `screen.getByText` / `screen.queryByText` for presence checks
- Use `toHaveAttribute` for link assertions

**Reference:** `src/app/explore/[id]/page.test.tsx`

## Integration Tests

End-to-end flows that span multiple hooks/components. Keep them in `src/app/<route>/` alongside the page.

**Reference:** `src/app/solve/accept-intent.integration.test.tsx:40-76`

## Fuzz Testing

Property-based (fuzz) tests exercise parsers and validators with randomly generated inputs to surface edge cases that hand-written example tests miss.

### Tooling

- **Library:** [fast-check](https://github.com/dubzzzka/fast-check) (`fast-check` v3)
- **Arbitraries:** shared in `src/test/arbitraries.ts`
- **Test files:** `<module>.fuzz.test.ts` next to the source they exercise

### Shared Arbitraries

| Arbitrary | Produces |
|---|---|
| `arbitraryXdrEnvelope` | Valid XDR envelopes built via `TransactionBuilder` |
| `arbitraryMutatedXdrEnvelope` | Valid XDR with random byte-flips |
| `arbitraryCsvCell` | CSV cells including formula-trigger characters |
| `arbitraryUnicodeString` | Strings across all Unicode blocks |
| `arbitraryDangerousUnicodeString` | Strings containing bidi/zero-width control chars |
| `arbitraryValidStellarAddress` | Valid G-strkeys from `Keypair.random()` |
| `arbitraryCorruptedStellarAddress` | Strkeys with corrupted checksums or wrong lengths |
| `arbitraryJson` | JSON with extreme nesting and prototype keys |

### Configuration

- **`FUZZ_RUNS`** — number of iterations per property (default `100`; set to `10000` in CI nightly)
- **`FUZZ_SEED`** — fixed seed for reproducibility; logged in CI output

### How to Add a Fuzz Property

1. Create `src/lib/<module>.fuzz.test.ts`.
2. Import the relevant arbitraries from `../test/arbitraries`.
3. Write a `fc.property(...)` that encodes the invariant you want to verify.
4. Wrap it in `fc.assert(..., { numRuns: getNumRuns(), seed: getSeed() })`.
5. Add a **corpus-replay** `describe` block that loads `src/test/fuzz-corpus/` entries and re-runs the same property on them.

Example:

```ts
import { describe, expect, it } from "vitest";
import fc from "fast-check";
import { arbitraryCsvCell, getNumRuns, getSeed } from "../test/arbitraries";
import { escapeCsv } from "./csv";

describe("escapeCsv — fuzz properties", () => {
  const numRuns = getNumRuns();
  const seed = getSeed();

  it("output never begins with a formula trigger character", () => {
    fc.assert(
      fc.property(arbitraryCsvCell, (cell) => {
        const escaped = escapeCsv(cell);
        expect(escaped[0]).not.toBe("=");
        expect(escaped[0]).not.toBe("+");
        expect(escaped[0]).not.toBe("-");
        expect(escaped[0]).not.toBe("@");
      }),
      { numRuns, seed }
    );
  });
});
```

### Corpus

When a fuzz test fails, the failing input is saved to `src/test/fuzz-corpus/` as a JSON file.  On the next `npm run test` run the corpus-replay block in each `.fuzz.test.ts` file loads those entries and replays them as ordinary unit tests, ensuring regressions are caught even without the fuzz runner.

### Running Fuzz Tests Locally

```bash
# Short run (100 iterations, fast feedback)
npm run test

# Extended run (10 000 iterations, useful for CI-like depth)
FUZZ_RUNS=10000 npm run test

# Reproducible run with a fixed seed
FUZZ_RUNS=10000 FUZZ_SEED=42 npm run test
```

### CI

A nightly scheduled job (`cron: "0 3 * * *"`) runs the extended fuzz suite with `FUZZ_RUNS=10000` and a 5-minute timeout.  The random seed used is logged in the job output for reproducibility.  Corpus artifacts are uploaded on failure.

## Mock API (MSW)

`src/mocks/` holds one MSW route table for the relay REST API. The same handlers
serve the browser (`npm run dev:mock`), Vitest (`src/mocks/server.ts`, started by
`vitest.setup.ts`) and Playwright (`getResponse` in `e2e/swap-happy-path.spec.ts`).

- **Handlers:** `src/mocks/handlers.ts` (`createHandlers(scenario)`)
- **Fixtures:** `src/mocks/fixtures.ts` — seeded generators (`createRng`, `createFeed`, `createQuote`, `createSolver`) and the in-memory `MockDb`
- **Scenarios:** `src/mocks/scenarios.ts`
- **Browser:** `src/mocks/browser.ts` + `MockApiGate` (wired in `src/app/layout.tsx`, inert unless `NEXT_PUBLIC_MOCK_API=1` outside production)

### Scenario catalogue

Select in the browser with `?mock=<name>` on `npm run dev:mock`.

| Scenario  | Feed rows | Latency | Behaviour                          |
| --------- | --------- | ------- | ---------------------------------- |
| `default` | 12        | none    | Normal responses                   |
| `empty`   | 0         | none    | Empty lists                        |
| `error`   | 0         | none    | Every mocked request returns 500   |
| `slow`    | 12        | 2 s     | Normal responses after a delay     |
| `large`   | 5,000     | none    | Large feed for virtual-list checks |

### Stateful behaviour

- `POST /intents` adds the intent to `GET /intents` and to the top of `GET /intents/feed`.
- `POST /intents/:id/submit` moves the intent to `pending`.
- Unknown intent IDs return 404.

### Limits

- The mock WebSocket server is not implemented yet; live-update UI will not receive pushed transitions in `dev:mock`.
- Fixtures are not yet validated against the runtime schemas in `src/lib/schemas.ts`.
- Storybook is not wired to MSW yet.

## Mutation Testing

Line coverage does not show whether tests would catch a bug. [Stryker](https://stryker-mutator.io/)
(v9, `@stryker-mutator/vitest-runner`) injects small faults (e.g. `>=` → `>`) into the
pure libraries under `src/lib/**` and checks that some test fails for each one.
Configuration lives in `stryker.config.mjs`.

- **Scope:** `src/lib/**/*.{ts,tsx}`, excluding `*.test.*`, `*.fuzz.test.*`, `*.d.ts`
  and `src/lib/i18n/messages/**`. React components are out of scope.
- **Coverage analysis:** `perTest`, so each mutant only runs the tests that reach it.
- **Thresholds:** Stryker fails the run below `break: 75`. The PR check also fails if a
  changed file is below its floor: 85% for `csv`, `xdrReview`, `textSafety` and `decimal`,
  75% otherwise (see `scripts/mutation-summary.mjs`).
- **Timeouts:** `timeoutMS: 10000` with `timeoutFactor: 3`, so slow runners are not
  counted as "timeout" kills.

### Running locally

```bash
# Full run over all of src/lib (nightly CI uses this)
npm run test:mutation

# Incremental run; reuses reports/stryker-incremental.json (PR CI uses this)
npm run test:mutation:incremental

# A single file: pass the module with --mutate (the test file is found via perTest coverage)
npx stryker run --mutate src/lib/csv.ts
```

The HTML report is written to `reports/mutation/index.html`; the JSON report used by the
PR summary is `reports/mutation/mutation.json`. Both directories are git-ignored.

To print the PR summary locally against a base branch:

```bash
npm run check:mutation-summary -- origin/main
```

### CI

- **Pull requests:** incremental run restoring `reports/stryker-incremental.json` from
  `actions/cache`. The changed-file score table is posted as a PR comment. Target: under
  5 minutes.
- **Nightly (`cron: "0 3 * * *"`):** full run, uploaded as the `mutation-report` artifact.

### Triaging surviving mutants

1. Open the HTML report and filter to *Survived* or *NoCoverage* mutants.
2. If a test should have caught the mutant, add an assertion that fails under it.
   Prefer explicit assertions to snapshots: a snapshot can hide the change.
3. If the mutant is equivalent (it cannot change observable behaviour), suppress it on
   that line with a justification:

   ```ts
   // Stryker disable next-line EqualityOperator: `<=` and `<` are identical for integers here
   ```

   Never suppress a mutant only because it is hard to kill.

### Writing mutation-resistant tests

- Inject clocks and random sources instead of calling `Date.now()` or `Math.random()`
  inside the unit under test, so boundary tests can pin the value.
- Test both sides of every comparison at the boundary (`=`, `-1`, `+1`).
- Assert the exact value returned, not only that it is truthy or non-empty.

### Baseline

Baseline scores are recorded here once the first full nightly run completes. Ratchet
`break` upward in `stryker.config.mjs` as the scores improve.

## Explore virtual list (#444)

`src/components/VirtualList.tsx` is a reusable windowed list (single-column
`role="grid"` with `aria-rowcount`/`aria-rowindex` and `aria-activedescendant`).
Rows are measured with TanStack Virtual's `measureElement`, so wrapped chips and
long solver names never clip.

- **Keyboard:** Up/Down/Home/End/PageUp/PageDown move the active row, Enter opens
  the intent, and `/` focuses the search box from anywhere on `/explore`.
- **Scroll restoration:** scroll offset + active row are saved to
  `sessionStorage` under `vortex-vlist:explore?<query>` (filters live in the URL)
  and restored on back navigation. Restoration is skipped if the first row
  changed or the row count moved by more than 20%.
- **Prepends:** when new intents stream in above the viewport the scroll offset
  is shifted so the visible row stays anchored.
- Pure helpers (`nextActiveIndex`, `isRestorable`) are unit-tested in
  `src/components/VirtualList.test.ts`.

### Performance measurement method

1. `npm run build && npm start`, open `/explore` with a relay (or mocked
   `useLiveIntents`) returning 5,000 intents.
2. Chrome DevTools → Performance → CPU 4× slowdown ("mid-range laptop" profile).
3. Record while scrolling the list top→bottom with the mouse wheel for ~10 s.
4. Read the FPS track / frames summary; the budget is ≥ 55 fps average with no
   long tasks > 50 ms during scroll.

## End-to-End Tests (Playwright)

Specs live in `e2e/*.spec.ts`. `playwright.config.ts` runs each spec under three
projects (`chromium`, `firefox`, `webkit`), serves the production build on
`:3000` unless `BASE_URL` is set, and enables traces on the first retry.

- `npm run test:e2e` runs the full suite; `npx playwright test --project=chromium`
  runs one browser. Pull requests run Chromium only; `main` and nightly runs use
  the full matrix (`.github/workflows/ci.yml`).
- Selectors use roles, labels and visible text (`getByRole`, `getByPlaceholder`),
  not CSS selectors.

### Shared fixtures

- **`e2e/fixtures/wallet.ts`** — `mockFreighter(page, overrides?)` replaces the
  Freighter extension bridge (`window.postMessage`) with a stub. Options:
  `publicKey`, `network` (`"TESTNET"` / `"PUBLIC"`), and `signing`
  (`"approve"` / `"reject"` / `"timeout"`). Call `setFreighterState(page, patch)`
  to switch account, network or signing outcome mid-test. State resets on every
  navigation because the init script re-runs.
- **`e2e/fixtures/api.ts`** — `mockBackend(page)` stubs the API on
  `http://localhost:4000` for the swap flow. Add `page.route` calls after it to
  override a single response.

### Coverage matrix (journey × browser)

✅ = spec exists and is scheduled in CI for that project. "Planned" = journey is
in the scope of #515 but no spec exists yet. Nothing in this table has been run
through the 10× flake check yet.

| Journey | Spec | Chromium | Firefox | WebKit |
| --- | --- | --- | --- | --- |
| Command palette: open with shortcut, filter, navigate | `e2e/command-palette.spec.ts` | ✅ | ✅ | ✅ |
| Swap happy path: connect, quote, submit | `e2e/swap-happy-path.spec.ts` | ✅ | ✅ | ✅ |
| Contributors page renders with no CSP violations | `e2e/contributors-csp.spec.ts` | ✅ | ✅ | ✅ |
| Preview smoke: `/`, `/markets`, `/portfolio` | `e2e/smoke/preview-smoke.spec.ts` | ✅ | ✅ | ✅ |
| Solver registration wizard (happy + unhappy) | planned | — | — | — |
| Accept intent, including conflict | planned | — | — | — |
| Explore: filters, search, URL restoration, virtual list keyboard nav | planned | — | — | — |
| My Intents: connect gating, export | planned | — | — | — |
| Governance: browse and vote (mocked) | planned | — | — | — |
| Offline banner and recovery | planned | — | — | — |
| Network mismatch blocking | planned | — | — | — |
| Locale switch persistence | planned | — | — | — |
