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
