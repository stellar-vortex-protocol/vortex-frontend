# Commands

All commands are run from the repository root with npm.

## Core

| Command | What it does | When to run it |
| --- | --- | --- |
| `npm run dev` | Starts the local development server with hot reload. | While developing locally. |
| `npm run build` | Produces a production build of the app. | Before opening a PR and to verify production output. |
| `npm run lint` | Runs the linter across the codebase. | Before committing and before opening a PR. |
| `npm test` | Runs the test suite. | Before committing and before opening a PR. |

## Doctor and checks

These commands are required by the PR template (`.github/PULL_REQUEST_TEMPLATE.md`) before merge. Run the relevant ones locally before opening a PR.

| Command | What it checks | When to run it |
| --- | --- | --- |
| `npm run doctor` | Verifies the local toolchain and environment are set up correctly. | After cloning, after dependency changes, and when something behaves unexpectedly. |
| `npm run check:env` | Validates that required environment variables are present and well-formed. | After changing `.env` files or when the app fails to start. |
| `npm run check:i18n` | Checks translation files for missing or malformed keys. | After adding or editing user-facing strings. |
| `npm run check:editorconfig` | Confirms files adhere to `.editorconfig` formatting rules. | Before opening a PR. |
| `npm run check:manifest` | Validates the app manifest is well-formed and consistent. | After editing the manifest or related config. |
| `npm run check:dependencies` | Flags dependency issues such as duplicates or disallowed versions. | After changing `package.json` or the lockfile. |
| `npm run check:bundle-size` | Checks the production bundle against size budgets. | Before opening a PR that changes shipped code. |
| `npm run check:story-coverage` | Reports components missing Storybook stories. | After adding or changing UI components. |
| `npm run check:merge-debris` | Detects leftover merge conflict markers and debris. | Before opening a PR and after resolving conflicts. |
| `npm run check:orphan-tests` | Finds test files that no longer map to source files. | After moving, renaming, or deleting source files. |
| `npm run check:no-empty-modules` | Flags empty or placeholder modules that should be removed or filled in. | Before opening a PR. |
| `npm run check:single-ssrf-guard` | Ensures there is a single SSRF guard implementation rather than duplicates. | After touching network/request handling code. |

## Troubleshooting

If a check fails and you are unsure why, see the troubleshooting table in the project notes rather than duplicating it here.
