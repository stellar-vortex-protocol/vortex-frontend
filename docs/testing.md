# Testing Conventions

## Tooling

- **Test runner:** Vitest (`vitest run`, `vitest run --coverage`)
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

When a fuzz test fails, the failing input is saved to `src/test/fuzz-corpus/` as a JSON file.  On the next `npm test` run the corpus-replay block in each `.fuzz.test.ts` file loads those entries and replays them as ordinary unit tests, ensuring regressions are caught even without the fuzz runner.

### Running Fuzz Tests Locally

```bash
# Short run (100 iterations, fast feedback)
npm test

# Extended run (10 000 iterations, useful for CI-like depth)
FUZZ_RUNS=10000 npm test

# Reproducible run with a fixed seed
FUZZ_RUNS=10000 FUZZ_SEED=42 npm test
```

### CI

A nightly scheduled job (`cron: "0 3 * * *"`) runs the extended fuzz suite with `FUZZ_RUNS=10000` and a 5-minute timeout.  The random seed used is logged in the job output for reproducibility.  Corpus artifacts are uploaded on failure.
