# Configuration

All environment variables are defined once, in `src/lib/env-schema.mjs`.
Everything else is derived from or checked against that schema:

| Consumer                     | How it uses the schema                                                                 |
| ---------------------------- | -------------------------------------------------------------------------------------- |
| `src/lib/config.ts`          | Parses the variables once and exports a frozen, typed `config`. The only app module that reads `process.env` |
| `next.config.mjs`            | Uses the same defaults for the CSP `connect-src` origins, and fails on invalid values |
| `scripts/check-env-vars.mjs` | `npm run check:env` (CI, and the first step of `npm run build`)                       |
| `.eslintrc.json`             | `no-restricted-properties` rejects `process.env` anywhere else in `src/`              |

## Variables

| Variable                               | `config` key             | Default                 | Valid values                                        |
| -------------------------------------- | ------------------------ | ----------------------- | --------------------------------------------------- |
| `NEXT_PUBLIC_API_URL`                  | `apiUrl`                 | `http://localhost:4000` | `http(s)://` URL; `https://` in production          |
| `NEXT_PUBLIC_WS_URL`                   | `wsUrl`                  | `null` (live updates off) | `ws(s)://` URL; `wss://` in production            |
| `NEXT_PUBLIC_NETWORK`                  | `network`                | `testnet`               | `testnet` \| `futurenet` \| `mainnet`               |
| `NEXT_PUBLIC_SETTLEMENT_CONTRACT`      | `settlementContract`     | empty                   | empty, or a Soroban contract ID (`C…`, 56 chars)    |
| `NEXT_PUBLIC_SOLVER_REGISTRY_CONTRACT` | `solverRegistryContract` | empty                   | empty, or a Soroban contract ID (`C…`, 56 chars)    |
| `NEXT_PUBLIC_SITE_URL`                 | `siteUrl`                | `http://localhost:3000` | `http(s)://` URL; `https://` in production          |

"Production" means `NODE_ENV=production` (i.e. `next build` / `next start`).
`localhost`, `127.0.0.1` and `[::1]` may use `http://` / `ws://` even then, so
production builds can be tested locally. Trailing slashes are removed from
`apiUrl` and `siteUrl`.

An invalid value fails loudly with the variable name and the expected format,
for example:

```
Invalid environment configuration:
  - NEXT_PUBLIC_NETWORK must be one of testnet | futurenet | mainnet (got "mainet")
```

`npm run check:env` also fails when:

- `.env.example` repeats a variable or doesn't list exactly the schema's variables
- the README "Required Environment Variables" table doesn't list exactly the schema's variables
- source under `src/` reads a `process.env` variable the schema doesn't define
- a `NEXT_PUBLIC_*` variable's name looks like a secret (see `docs/security-audit.md`)
- the environment's manifest isn't satisfied (see below)

## The env manifest check

`scripts/env-manifest.mjs` is the manifest of what each environment expects:
which variables must be set, which networks are allowed, and whether localhost
or plain `http://` / `ws://` is accepted. `scripts/check-env-vars.mjs` runs it
as part of `npm run check:env`, so a missing or misspelled key in `.env.local`
is caught before it reaches a build.

Run the check from the repo root:

```
npm run check:env
```

It validates that every variable the schema defines is present and well-formed,
that `.env.example` and the README table list exactly the schema's variables,
and that the environment's manifest is satisfied.

When the check fails, compare your `.env.local` against `.env.example` (the
canonical list of variable names and example values) and fix any missing or
misspelled entries. Don't duplicate the full variable list here — `.env.example`
is the source of truth. If `npm run build` fails with an environment error, see
the troubleshooting table in the project notes.

## Per-environment manifests

`config/environments/{development,preview,production}.json` hold the
expectations for each deployment: which variables must be set, which networks
are allowed, and whether localhost or plain `http://` / `ws://` is accepted.
They contain rules only, never secret values. `scripts/env-manifest.mjs`
checks an environment map against them, plus these cross-field invariants:

- `mainnet` requires `https://` / `wss://` URLs that aren't localhost, in any environment
- `NEXT_PUBLIC_WS_URL` must be on the same domain as `NEXT_PUBLIC_API_URL`
- the settlement and solver registry contract IDs must differ when both are set

Contract IDs are not required in any manifest, because they stay empty until
deployed. The Stellar contract ID (`C…`) has the same prefix on every network,
so the network is not checked against the contract ID's prefix.

The environment is taken from `VORTEX_ENV`, then `VERCEL_ENV`, then
`NODE_ENV`. CI sets `VORTEX_ENV` on its build steps: `production` in
`deploy.yml` and `preview` in `preview-deploy.yml`.

Preview deployments set `NEXT_PUBLIC_PREVIEW_*` secrets; `preview-deploy.yml`
maps them onto the variables above, so the app itself only reads the names in
the table.

`NEXT_PUBLIC_*` values are inlined into the browser bundle at build time, and
only when read by their literal name. That's why `config.ts` lists each one
explicitly rather than looping over the schema.

## Adding a new environment variable

Worked example: an optional `NEXT_PUBLIC_EXPLORER_URL` for transaction links.

1. **Schema:** add an entry to `ENV_SCHEMA` in `src/lib/env-schema.mjs`:

   ```js
   {
     name: "NEXT_PUBLIC_EXPLORER_URL",
     key: "explorerUrl",
     description: "Block explorer base URL used for transaction links",
     example: "https://stellar.expert/explorer",
     default: "https://stellar.expert/explorer",
     allowEmpty: false,
     validate: urlValidator(["https:"], "https:", "https://stellar.expert/explorer"),
   },
   ```

2. **Typed config:** in `src/lib/config.ts`, add `explorerUrl: string` to
   `AppConfig`, return `explorerUrl: text("explorerUrl")` from `loadConfig`,
   and add `NEXT_PUBLIC_EXPLORER_URL: process.env["NEXT_PUBLIC_EXPLORER_URL"]`
   to the object passed to `loadConfig`.
3. **Docs:** add the variable to `.env.example`, to the README "Required
   Environment Variables" table and to the table above. `npm run check:env`
   fails until the first two match the schema.
4. **Tests:** add valid / missing / malformed (and production, if the rules
   differ) rows to the table in `src/lib/config.test.ts`.
5. **Use it** via `import { config } from "@/lib/config"`, never `process.env`.
