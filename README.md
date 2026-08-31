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

- Node.js 20+
- A running [`vortex-backend`](https://github.com/stellar-vortex-protocol/vortex-backend) relay (set its URL in `.env.local`)

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

### Bundle Analysis

To generate a visual breakdown of the production bundle, build with the `ANALYZE=true` flag:

```bash
ANALYZE=true npm run build
```

This generates an interactive treemap visualization in `.next-analyze/` showing what modules contribute to bundle size. Open `client.html` in your browser to explore the breakdown.

The CI pipeline automatically generates and uploads bundle analysis reports on every build as a downloadable artifact, making it easy to spot size regressions in pull requests.

### Visual Regression Testing

Storybook components are tested for visual regressions using Playwright. This catches unintended CSS changes that might break component appearance.

**Run locally:**

```bash
npm run storybook      # Start Storybook dev server on http://localhost:6006
npm run build:storybook # Build Storybook static site
npm run test:visual    # Run visual regression tests
```

**Workflow:**

1. Tests run against the built Storybook (`storybook-static/`)
2. Playwright captures screenshots of all story variants
3. Screenshots are compared against baseline images
4. Differences are reported as test failures
5. CI artifacts include a visual regression report with diffs

**First time setup / Updating baselines:**

When adding new stories or intentionally changing component styles, update the baseline snapshots:

```bash
npm run build:storybook
npm run test:visual -- --update
```

Commit the updated baseline images in `.storybook/playwright/` so future runs have a reference point.

The CI pipeline runs visual regression tests on every build, preventing CSS regressions from reaching production.

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

### Code Ownership & Review Requirements

This repository uses a [CODEOWNERS](./.github/CODEOWNERS) file to automatically assign reviewers based on the paths changed in a pull request. Critical areas like wallet storage (`src/store/wallet.ts`), API logic (`src/lib/api.ts`), solver registration, and CI/CD workflows require approval from designated maintainers before merging.

For more details, see the [CODEOWNERS](./.github/CODEOWNERS) file.

### Security Practices

- **Pinned Actions**: All GitHub Actions used in CI/CD workflows are pinned to specific commit SHAs (not mutable version tags) to prevent supply-chain attacks. Version comments are included for readability.
- **Dependabot**: Automatically maintains SHA pins via weekly GitHub Actions updates. Review and merge Dependabot PRs to stay current with security patches.
- **Minimal Permissions**: Workflows declare only the minimum required permissions (`contents: read`, `checks: write`) following the principle of least privilege.

### Issue Complexity Labels

Issues on the Wave tracker use the following complexity labels with corresponding point values to help contributors find tasks that match their availability:

| Label | Points | Description |
|---|---|---|
| Trivial | 1 | Small fix, typo, or minor change — quick to complete |
| Medium | 3 | Feature work or bug fix requiring moderate investigation |
| High | 5 | Significant implementation effort or architectural change |

See the org-wide
[CONTRIBUTING.md](https://github.com/stellar-vortex-protocol/.github/blob/main/CONTRIBUTING.md).

## License

[MIT](./LICENSE) © 2025 Vortex Protocol Contributors
