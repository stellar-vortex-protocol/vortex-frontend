# Contributing to Vortex Protocol Frontend

Thank you for your interest in contributing to Vortex Protocol!

## Code of Conduct

All contributors and maintainers are expected to adhere to our [Code of Conduct](./CODE_OF_CONDUCT.md). Please read it before participating in community discussions, submitting issues, or creating pull requests.

## Quick Start (about 10 minutes)

Requires Node 20 (see `.nvmrc`).

```bash
git clone <your fork> && cd vortex-frontend
nvm install && nvm use     # or fnm / volta; matches .nvmrc
npm install                # also installs the Husky git hooks
cp .env.example .env.local # defaults point at a local vortex-backend on :4000
npm run doctor             # diagnoses Node, env, lockfile, hooks, Playwright, ports, backend
npm run dev                # http://localhost:3000
```

Run `npm run doctor` any time setup misbehaves. It prints a `fix:` line for each problem and exits non-zero only on blocking failures. The `.devcontainer/` config (VS Code or GitHub Codespaces) does the install, env copy and Playwright setup for you.

No `vortex-backend` running? The app still builds and renders, but live data calls will fail until you start one or point `NEXT_PUBLIC_API_URL` at a backend you can reach. A shared mock-backend mode is not available yet.

## Common Failures

| Symptom | Cause | Fix |
| --- | --- | --- |
| `Node.js version mismatch` from the Husky hook | Node is not the version in `.nvmrc` | `nvm use` (or `fnm use` / `volta install node@20`), then retry |
| `npm run build` fails with `must be ...` env errors | Invalid value in `.env.local` | Compare with `.env.example`; `npm run check:env` names the variable |
| Commit rejected by `commit-msg` | Message is not Conventional Commits | Use `feat:`, `fix:`, `chore:` ... (`commitlint.config.js`) |
| Hooks never run | `core.hooksPath` not set | `npm run prepare` (it verifies `core.hooksPath` is `.husky` and exits non-zero with a hint if it cannot be set) |
| `npm ci` fails on `package-lock.json` | Lockfile out of sync with `package.json` | `npm install`, then commit the updated lockfile |
| `browserType.launch: Executable doesn't exist` in e2e | Playwright browsers not installed | `npx playwright install --with-deps chromium` |
| `EADDRINUSE :3000` | Another dev server is running | Stop it, or `PORT=3001 npm run dev` |
| Windows/WSL: hooks or scripts fail on CRLF or path errors | Checkout converted line endings | Clone inside the WSL filesystem (not `/mnt/c`) and keep `.editorconfig` line endings (LF) |
| Behind a corporate proxy: `npm install` times out | Registry blocked | Set `HTTPS_PROXY` / `npm config set proxy`, or ask a maintainer for the registry mirror |
| Offline install | No registry access | Use a warm npm cache (`npm ci --prefer-offline`) from a machine that already installed |

## How to Contribute

1. **Pick an Issue**: Check out open issues tagged with complexity labels on the [Wave Tracker](/contributors) or in `issues.md`.
2. **Follow Guidelines**: Ensure all user-submitted text follows sanitization standards (`src/lib/textSafety.ts`).
3. **Logging**: Never call `console.*` in `src/**`; use `secureLogger` from `src/lib/secureLogging.ts`, which redacts keys, XDR, tokens and mnemonics. `npm run lint` fails on violations. If you find a new sensitive format, add a rule to `DEFAULT_RULES` with a test.
4. **Browser storage**: Never touch `localStorage`/`sessionStorage` directly; register the key in `STORAGE_KEYS` and use the `storage` facade in `src/lib/storage.ts` (lint-enforced).
5. **Submit PR**: Open a pull request detailing your changes and referencing the closed issue (`Closes #N`).

## PR Checklist

Mirrors the baseline Definition of Done. Every PR should pass:

- [ ] One PR contains code, tests and docs, and references the issue (`Closes #N`)
- [ ] `npm run lint`, `npm run typecheck`, `npm test`, `npm run check:i18n` and `npm run check:editorconfig` pass
- [ ] No new `any`, no `@ts-ignore` / `eslint-disable` without a justification comment, no new `console.*` (use `secureLogger`)
- [ ] New user-facing strings are in both `src/lib/i18n/messages/en.ts` and `es.ts`
- [ ] New interactive UI is keyboard-operable, has visible focus and ARIA semantics, and works in dark and light palettes (`src/app/globals.css`)
- [ ] UI changes include before/after screenshots (desktop and ~400px mobile); behaviour changes include a recording or test output
- [ ] Docs under `docs/` (and `README.md` if routes, scripts or env vars changed) are updated
- [ ] No secrets committed; env changes are reflected in `.env.example` and pass `npm run check:env`

## Good First Review (for maintainers)

A reviewer does not need to know the whole app to be useful. A first review should:

1. Run `npm run doctor` and `npm run dev` on the PR branch, or open the preview deployment.
2. Read the diff for scope: does it do only what the linked issue asks?
3. Check the checklist above, especially the i18n, logging and storage rules.
4. Click through the changed screen with keyboard only, then in dark and light palettes.
5. Leave a review with specific file and line comments. Approval from a `CODEOWNERS` maintainer is still required.

## Good First Issue Mentors

A maintainer can opt a good-first issue into having a mentor by adding `Mentor: <github-handle>` to its entry in `issues.md`, next to `Good first issue: yes`:

```
- #14 Swap Sound Effects (Complexity: Trivial, Points: 50, Status: Open, Contributor: None, Good first issue: yes, Mentor: octocat)
```

The Wave Tracker then shows an "Ask @handle about this one" link to that person's GitHub profile on the issue's card. Mentoring is optional and informal: the mentor agrees to answer questions about that specific issue (scope, where to look in the code, review expectations) on a best-effort basis. They are not expected to write the change, and the link is not an in-app chat or scheduling system. Only add a mentor who has agreed to it, and remove the field if they can no longer help. The handle is not validated against GitHub when `issues.md` is parsed.

## Reporting Conduct Issues

If you experience or witness unacceptable behavior, please contact the maintainers at `conduct@vortexprotocol.io`, the single conduct-reporting channel (also listed in the [Code of Conduct](./CODE_OF_CONDUCT.md)).
