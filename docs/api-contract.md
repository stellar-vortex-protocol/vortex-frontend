# API Contract (Generated Types & Validators)

The relay's wire types and runtime parsers are generated from a committed OpenAPI 3.1 snapshot,
so backend drift shows up as a type error or a failing CI job instead of a production bug.

## Files

| Path                          | Role                                                                          |
| ----------------------------- | ----------------------------------------------------------------------------- |
| `spec/relay.openapi.json`     | Contract snapshot. Source of truth for the frontend.                          |
| `scripts/gen-api.mjs`         | Dependency-free generator. `--check` detects drift.                           |
| `src/lib/generated/relay.ts`  | Generated models and parsers. Do not edit by hand.                            |
| `src/lib/types.ts`            | Re-exports the generated models (`FeedItem`, `IntentStatus`, …).              |
| `src/lib/schemas.ts`          | Re-exports the generated parsers (`parseFeedItem`, …).                        |
| `.github/workflows/contract-drift.yml` | CI job `contract-drift`.                                             |

The snapshot's `info.version` and `info["x-source"].commit` identify which backend build it was
taken from. The generated file header repeats both.

## Commands

- `npm run gen:api`: regenerate `src/lib/generated/relay.ts` from the snapshot.
- `npm run check:contract`: fail if the committed generated file is stale.
- `node scripts/gen-api.mjs --check --upstream <file>`: also fail if `<file>` (the backend's current
  spec) differs from the snapshot. CI does this when the repository variable `RELAY_SPEC_URL` is set.

## CI job `contract-drift`

Runs on pull requests, pushes to `main`, daily, and on demand.

- If `RELAY_SPEC_URL` is set, the job downloads the backend spec and fails when it differs from
  `spec/relay.openapi.json`. Comparison ignores key order.
- It always fails when the committed generated file is out of date.
- If `RELAY_SPEC_URL` is unset, it emits a warning and checks only the generated output.

## The backend changed — now what?

1. Get the backend's new spec (the file behind `RELAY_SPEC_URL`, or the backend release asset).
2. Replace `spec/relay.openapi.json` with it. Keep `info.version` and `info["x-source"].commit`
   accurate so the generated header names the backend build.
3. Run `npm run gen:api`.
4. Run `npm run typecheck`. Each compile error is a call site that depends on the changed shape;
   fix those call sites in the same PR.
5. Check the diff of `src/lib/generated/relay.ts`. Look at added or removed fields, changed
   optionality (`?`), and changed enum members.
6. For a new enum member, check that the UI handles it. Until it does, the parser maps it to
   `"unknown"`.
7. Run `npm run check:contract` and tick the "Spec updated" box in the PR template.
8. If the backend contract is not reachable (no `RELAY_SPEC_URL`, or the backend is not yet
   published), hand-edit the snapshot to match the agreed contract and say so in the PR.

## Compatibility rules

- **Unknown enum values** parse to `"unknown"` instead of throwing. Enum types therefore include
  `"unknown"`, so call sites must handle it. `IntentStatus` is the example.
- **Unknown properties** are stripped by the parsers and are not exposed on the typed object.
- **Missing or mistyped required properties** make the parser return `null`. Callers drop the frame
  or fall back, as `docs/websocket-protocol.md` describes.
- **Amounts** are decimal strings matched by a `pattern` (`^[0-9]+(\.[0-9]+)?$`). They are never numbers.
- **Optional vs. nullable.** A property marked `required` must be present. An optional property is
  declared `prop?: T` and must be absent or of type `T`, never `undefined` (the tsconfig sets
  `exactOptionalPropertyTypes`). Nullable scalars use `type: ["<T>", "null"]` and generate
  `prop: T | null`.
- **`version`** is an integer. The protocol doc describes it as a number; the integer rule is
  stricter on purpose.

## Supported spec subset

`scripts/gen-api.mjs` supports only what the frontend needs: `components.schemas` with object and
string-enum schemas; `string` (with `format: date-time` and `pattern`), `number`, `integer`,
`boolean`, `const`, `$ref` to a component, and `[T, "null"]` for nullable scalars. Anything else
throws with the schema path, so an unsupported change fails loudly instead of drifting silently.
Paths are documented in the snapshot but are not generated.

## Health route status codes

`GET /api/health` (`src/app/api/health/route.ts`) reports the aggregate state of its dependency
checks. The JSON body shape is unchanged; only the status code reflects the aggregate result.

| Status | Meaning                                                                         |
| ------ | ------------------------------------------------------------------------------- |
| `200`  | Every dependency check passed.                                                  |
| `503`  | At least one dependency check failed. The body names the failing dependency(s). |

Uptime monitors should treat any non-`200` response as degraded.

## Frontend-only types

Types that exist only in the frontend (view models, derived fields, UI state) stay in their own
modules and are not part of the contract. Examples include `TrackableIntent`
(`src/lib/intentLifecycle.ts`) and the analytics summaries in `src/lib/analytics.ts`.
