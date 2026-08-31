# vortex-frontend

**Swap UI + solver portal for [Vortex Protocol](https://github.com/stellar-vortex-protocol).**

[![CI](https://github.com/stellar-vortex-protocol/vortex-frontend/actions/workflows/ci.yml/badge.svg)](https://github.com/stellar-vortex-protocol/vortex-frontend/actions/workflows/ci.yml)
[![License: MIT](https://img.shields.io/badge/License-MIT-green.svg)](./LICENSE)

Next.js 14 app providing the user-facing swap interface, intent explorer,
and solver dashboard. Built with TypeScript, Tailwind CSS, Zustand, and
SWR, with Freighter wallet integration for signing swaps and solver
registrations. Part of the multi-repo Vortex stack — see also
[`vortex-contract`](https://github.com/stellar-vortex-protocol/vortex-contract) and
[`vortex-backend`](https://github.com/stellar-vortex-protocol/vortex-backend).

---

## Pages

| Route | File | Description |
|---|---|---|
| `/` | `src/app/page.tsx` | Swap interface, live fills feed, intent pipeline overview |
| `/explore` | `src/app/explore/page.tsx` | Browse all intents with status/chain filters, sorting, and pagination |
| `/explore/[id]` | `src/app/explore/[id]/page.tsx` | Single intent detail, with a settlement tx link once filled |
| `/solve` | `src/app/solve/page.tsx` | Solver leaderboard, open intents feed, and solver registration |

---

## Features

- **Wallet** — connect/disconnect Freighter, with the session persisted across reloads and silently restored (no popup) as long as the extension still allows the site.
- **Swaps** — live quotes over SWR, submitted end-to-end with Freighter signing.
- **Live data** — the homepage feed and the explorer both layer a WebSocket subscription on top of their REST snapshot, with a "Live"/"Polling" indicator reflecting actual socket state.
- **Solvers** — browse the leaderboard, accept open intents, and register a new solver (Stellar address + bond, validated client-side before submission).
- **Notifications** — a shared toast system surfaces the outcome of swaps, intent acceptance, solver registration, and wallet connection.
- **Responsive + accessible** — a mobile nav menu, ARIA-labeled forms/tabs/filters, a skip-to-content link, and keyboard-operable controls throughout.

---

## Local Development

### Prerequisites

- Node.js 20 (specified in `.nvmrc`)
- A running [`vortex-backend`](https://github.com/stellar-vortex-protocol/vortex-backend) relay (set its URL in `.env.local`)

#### Node Version Setup

This project enforces Node.js version 20. The `.nvmrc` file specifies the required version, and husky hooks will validate it on checkout.

If you use a Node version manager (nvm, fnm, volta, asdf, etc.), install the correct version:

```bash
# For nvm
nvm install && nvm use

# For fnm
fnm use

# For other managers, see their documentation
```

Then proceed with setup:

```bash
npm install
cp .env.example .env.local
npm run dev    # http://localhost:3000
```

### Required Environment Variables

| Variable | Where to get the value |
|---|---|
| `NEXT_PUBLIC_API_URL` | URL of your running `vortex-backend` relay |
| `NEXT_PUBLIC_WS_URL` | WebSocket URL of the relay (usually with `/ws` path) |
| `NEXT_PUBLIC_NETWORK` | Stellar network: `testnet`, `futurenet`, or `mainnet` |
| `NEXT_PUBLIC_SETTLEMENT_CONTRACT` | Settlement contract ID from `vortex-contract` deployment |
| `NEXT_PUBLIC_SOLVER_REGISTRY_CONTRACT` | Solver registry contract ID from `vortex-contract` deployment |

### Scripts

| Script | Description |
|---|---|
| `npm run dev` | Dev server |
| `npm run build` | Production build |
| `npm run start` | Serve the production build |
| `npm run lint` | `next lint` |
| `npm test` | Run the Vitest suite |

## Troubleshooting

### Freighter not detected

- Make sure the [Freighter](https://freighter.app/) extension is installed and unlocked.
- On Firefox, ensure the extension is enabled for the current container or profile.
- If you see "Freighter extension is not installed or enabled", try reloading the page after unlocking the extension.

### Backend relay not running or `.env.local` misconfigured

- Confirm `vortex-backend` is running and the relay is reachable.
- Verify `NEXT_PUBLIC_API_URL` in `.env/local` points to the correct backend origin.
- If `NEXT_PUBLIC_WS_URL` is missing, live feeds will silently fall back to polling only.
- Restart the dev server after changing `.env.local`.

### Wrong Node version

- This project requires **Node.js 20+**. Confirm with `node -v`.
- If you use `nvm` or `fnm`, run `nvm install && nvm use` (or the equivalent) from the repo root.

---

## Roadmap

- [x] Wallet integration — connect Freighter, sign swaps and solver registrations, persist sessions
- [x] Intent explorer page (`/explore`) — browse all intents with filtering, sorting, and pagination
- [x] Live WebSocket feeds for fills and open intents
- [x] Shared toast/notification system
- [x] Mobile responsive nav, accessibility pass
- [ ] Per-wallet swap history / "my intents" view
- [ ] Solver reputation detail (fill history, uptime over time)
- [ ] Localization

---

## Contributing

### Issue Complexity Labels

Issues on the Wave tracker use the following complexity labels with corresponding point values to help contributors find tasks that match their availability:

| Label | Points | Description |
|---|---|---|
| Trivial | 1 | Small fix, typo, or minor change — quick to complete |
| Medium | 3 | Feature work or bug fix requiring moderate investigation |
| High | 5 | Significant implementation effort or architectural change |

See the org-wide
[CONTRIBUTING.md](https://github.com/stellar-vortex-protocol/.github/blob/main/CONTRIBUTING.md).

### Changelog Updates

This project follows [Keep a Changelog](https://keepachangelog.com/) format with [Conventional Commits](https://www.conventionalcommits.org/).

**Automated changelog generation** — Maintainers can trigger the [Update CHANGELOG workflow](.github/workflows/changelog.yml) via GitHub Actions to automatically generate changelog entries from merged commits since the last release:

1. Go to the **Actions** tab → **Update CHANGELOG** workflow
2. Click **Run workflow** and enter the release version (e.g., `0.2.0`)
3. A PR will be created with the generated changelog entries
4. Review, adjust if needed, and merge to proceed with the release

The workflow uses `conventional-changelog` to parse commits tagged with standard types (`feat:`, `fix:`, `docs:`, etc.) and sections them automatically into **Added**, **Fixed**, **Changed**, etc.

### Dependency Management

**Major version updates** — Dependabot automatically creates grouped PRs for major version updates to critical dependencies:

- **@stellar/freighter-api** — Wallet interaction
- **@stellar/stellar-sdk** — Stellar blockchain operations
- **next** — Framework
- **react** / **react-dom** — UI library

Major-version PRs require special attention:
1. Run the full Playwright test suite (`npm run test:e2e`) against all browsers
2. Perform manual smoke tests on the swap flow and wallet integration
3. Check for deprecation warnings in the browser console
4. Review release notes for breaking changes affecting wallet operations

Minor and patch updates are auto-grouped for routine review. Major updates are grouped separately to ensure they receive the scrutiny wallet-adjacent code demands.

## License

[MIT](./LICENSE) © 2025 Vortex Protocol Contributors
