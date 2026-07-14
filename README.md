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

### Scripts

| Script | Description |
|---|---|
| `npm run dev` | Dev server |
| `npm run build` | Production build |
| `npm run start` | Serve the production build |
| `npm run lint` | `next lint` |
| `npm test` | Run the Vitest suite |

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

See the org-wide
[CONTRIBUTING.md](https://github.com/stellar-vortex-protocol/.github/blob/main/CONTRIBUTING.md).

## License

[MIT](./LICENSE) © 2025 Vortex Protocol Contributors
