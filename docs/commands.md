# Command palette

The palette (`Cmd/Ctrl+K`, [`CommandPalette.tsx`](../src/components/CommandPalette.tsx)) renders commands from a
module-level Zustand registry ([`src/lib/commands/registry.ts`](../src/lib/commands/registry.ts)).

- **Groups:** `Recent`, `Navigation`, `Wallet`, `Preferences`, `Solvers`. With an empty query only `Recent` and
  `Navigation` are listed; typing searches every visible command.
- **Ranking:** fuzzy subsequence match on the title (matched characters are highlighted) and keywords; prefixes
  and contiguous runs score higher, ties keep registration order.
- **`when()`** hides a command when it returns `false` (e.g. "Disconnect wallet" only while connected).
- **`dangerous: true`** requires a second Enter/click; the row reads "Press Enter again to confirm".
- **Recents:** the last 10 intents viewed on `/explore/[id]` (stored locally under `vortex-recent-intents`).
- The result count is announced via a polite live region; IME composition is ignored for navigation keys.

Built-ins live in [`BuiltinCommands.tsx`](../src/components/BuiltinCommands.tsx): connect/disconnect wallet, copy
address, switch language, reduce/enable motion (shares `vortex-motion-preference` with the settings panel), open
My Intents, and "View solver …" for up to 50 solvers from `useSolvers`.

## How to add a command

1. Build the command list in a client component, memoised so registration only reruns when inputs change.
2. Put every user-facing `title` through `t()` and add the keys to **both** `en.ts` and `es.ts`.
3. Call `useRegisterCommands(commands)`; commands are removed automatically on unmount.

```tsx
const { t } = useTranslation();
const commands = useMemo<CommandDefinition[]>(
  () => [
    {
      id: "explore-export-csv",
      title: t("commands.explore.exportCsv"),
      keywords: ["download", "csv"],
      group: "Navigation",
      when: () => rows.length > 0,
      run: exportCsv,
    },
  ],
  [t, rows.length, exportCsv],
);
useRegisterCommands(commands);
```

Outside React, `registerCommand(definition)` returns an unregister function. Ids must be unique; a later
registration with the same id replaces the earlier one.

## npm scripts

Every contributor-facing script in [`package.json`](../package.json), one line each. Run them from the repo root
with Node 20 (see `.nvmrc`).

| Command | What it does | When to run it |
| --- | --- | --- |
| `npm run dev` | Starts the Next.js dev server on http://localhost:3000. | While developing. |
| `npm run dev:mock` | Starts the dev server with `NEXT_PUBLIC_MOCK_API=1`. | When you have no backend to point at. |
| `npm run build` | Validates env vars, then builds the production bundle. | Before opening a PR that touches build config or env. |
| `npm run start` | Serves the production build from `npm run build`. | To check the built app locally. |
| `npm run lint` | Runs `next lint` (ESLint). | Before every push; part of the DoD. |
| `npm run typecheck` | Runs `tsc --noEmit` over the app. | Before every push; part of the DoD. |
| `npm run typecheck:storybook` | Type-checks the Storybook config with `tsconfig.storybook.json`. | After changing stories or `.storybook/`. |
| `npm run test` | Runs the Vitest suite once. | Before every push; part of the DoD. |
| `npm run test:coverage` | Runs Vitest with the v8 coverage report. | When checking coverage of new code. |
| `npm run test:mutation` | Runs the full Stryker mutation suite. | Before merging risky logic changes; slow. |
| `npm run test:mutation:incremental` | Runs Stryker incrementally against changed files. | During local mutation-testing iterations. |
| `npm run check:mutation-summary` | Summarises the last Stryker report. | After a mutation run, to read the score. |
| `npm run test:e2e` | Runs the Playwright end-to-end suite. | Before merging changes to flows covered by e2e. |
| `npm run test:storybook` | Runs the Storybook test-runner against http://127.0.0.1:6006. | With `npm run build:storybook` served, to test stories. |
| `npm run test:visual` | Runs Playwright visual tests against Storybook. | After UI changes, to compare snapshots. |
| `npm run update:visual` | Re-records the visual snapshots. | Only when an intended UI change alters snapshots. |
| `npm run build:storybook` | Builds the static Storybook. | Before `test:storybook` or visual tests. |
| `npm run check:editorconfig` | Runs `editorconfig-checker` over the repo. | Before every push; part of the DoD. |
| `npm run check:env` | Validates `.env.local` against `.env.example` and names bad variables. | After editing env files, or when `build` fails on env. |
| `npm run check:i18n` | Checks `en.ts` and `es.ts` message parity. | Before every push; part of the DoD. |
| `npm run check:stories` | Checks Storybook story coverage. | After adding or moving components. |
| `npm run check:contract` | Regenerates the API client and fails on drift. | After changing the API contract. |
| `npm run check:no-empty-modules` | Fails on empty or export-less modules. | Before pushing new files. |
| `npm run check:single-ssrf-guard` | Ensures only one SSRF guard implementation exists. | After touching outbound fetch code. |
| `npm run check:orphan-tests` | Flags test files with no matching source. | After renaming or deleting modules. |
| `npm run check:docs` | Validates the docs set. | After editing files under `docs/`. |
| `npm run check:manifest` | Validates the app manifest. | After changing `src/app/manifest.ts`. |
| `npm run check:dependencies` | Checks dependency usage and policy. | After adding or removing a dependency. |
| `npm run check:lockfile` | Lints the lockfile. | After any dependency change. |
| `npm run check:deps` | Runs the dependency policy check. | After any dependency change. |
| `npm run check:provenance` | Verifies build provenance metadata. | Before a release. |
| `npm run check:actionlint` | Runs `actionlint` over the GitHub workflows. | After editing `.github/workflows/`. |
| `npm run gen:api` | Regenerates the typed API client. | After the API contract changes. |
| `npm run sbom` | Writes `sbom.json`. | Before a release. |
| `npm run changelog` | Generates the changelog. | Before a release. |
| `npm run dependency-report` | Prints a dependency diff report. | When reviewing dependency changes. |
| `npm run doctor` | Diagnoses Node, env, lockfile, hooks, Playwright, ports and backend; prints a `fix:` line per problem. | After setup, or any time setup misbehaves. |
| `npm run prepare` | Installs the Husky git hooks. | Once after cloning, or if hooks never run. |
