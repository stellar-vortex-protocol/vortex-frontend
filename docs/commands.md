# Commands

All commands are run from the repository root. Scripts are defined in `package.json`.

## Development

| Command | Description |
| --- | --- |
| `npm run dev` | Start the Vite dev server. |
| `npm run build` | Type-check and build the production bundle. |
| `npm run preview` | Preview the production build locally. |
| `npm run typecheck` | Run `tsc --noEmit` to type-check without emitting. |

## Testing

| Command | Description |
| --- | --- |
| `npm test` | Run the test suite once. |
| `npm run test:watch` | Run tests in watch mode. |
| `npm run test:coverage` | Run tests and report coverage. |

## Checks

These scripts validate repository invariants. The PR template requires `check:editorconfig` and `check:i18n`; run the rest when your change touches the relevant area.

| Command | Description |
| --- | --- |
| `npm run check:editorconfig` | Verifies files conform to `.editorconfig` formatting rules. |
| `npm run check:i18n` | Verifies locale files have matching keys across languages (i18n parity). |
| `npm run check:merge-debris` | Scans for leftover merge conflict markers and merge debris. |
| `npm run check:no-empty-modules` | Flags empty module files that should contain code. |
| `npm run check:orphan-tests` | Detects test files that no longer map to a source module. |
| `npm run check:single-ssrf-guard` | Ensures there is a single SSRF guard implementation rather than duplicates. |
| `npm run check:story-coverage` | Verifies components have corresponding Storybook stories. |
| `npm run check:contract` | Verifies the generated relay contract matches the committed snapshot. |

## Code generation

| Command | Description |
| --- | --- |
| `npm run gen:api` | Regenerate the API client from `spec/relay.openapi.json`. |
