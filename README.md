# vortex-frontend

**Swap UI + solver portal for [Vortex Protocol](https://github.com/vortex-protocol).**

[![CI](https://github.com/vortex-protocol/vortex-frontend/actions/workflows/ci.yml/badge.svg)](https://github.com/vortex-protocol/vortex-frontend/actions/workflows/ci.yml)
[![License: MIT](https://img.shields.io/badge/License-MIT-green.svg)](./LICENSE)

Next.js 14 app providing the user-facing swap interface and the solver
dashboard. Part of the multi-repo Vortex stack — see also
[`vortex-contract`](https://github.com/vortex-protocol/vortex-contract) and
[`vortex-backend`](https://github.com/vortex-protocol/vortex-backend).

---

## Pages

| Route | File | Description |
|---|---|---|
| `/` | `src/app/page.tsx` | Main swap interface |
| `/solve` | `src/app/solve/page.tsx` | Solver dashboard |

---

## Local Development

### Prerequisites

- Node.js 20+
- A running [`vortex-backend`](https://github.com/vortex-protocol/vortex-backend) relay (set its URL in `.env.local`)

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

---

## Roadmap

- [ ] **Intent explorer page** (`/explore`) — browse all intents with filtering and sorting
- [ ] **Wallet integration** — connect Freighter, sign intents, track history

---

## Contributing

See the org-wide
[CONTRIBUTING.md](https://github.com/vortex-protocol/.github/blob/main/CONTRIBUTING.md).

## License

[MIT](./LICENSE) © 2025 Vortex Protocol Contributors
