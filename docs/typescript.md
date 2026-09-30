# TypeScript

`tsconfig.json` runs the compiler in a strict profile, and CI enforces it:
`npm run typecheck` (`tsc --noEmit`) is a required step in `.github/workflows/ci.yml`
that runs before lint and the tests, and must report zero errors. `e2e/`,
`playwright.config.ts` and `*.stories.tsx` are excluded (see `exclude`).

Don't loosen a flag or add `// @ts-ignore` to get a change through; narrow the
type instead. Prefer small type guards (see `src/lib/schemas.ts`) over `as`
assertions.

## Flags beyond `strict`

| Flag | What it catches |
| ---- | --------------- |
| `noUncheckedIndexedAccess` | `arr[i]` and `record[key]` are `T \| undefined` |
| `exactOptionalPropertyTypes` | `{ x?: string }` does not accept `{ x: undefined }` |
| `noPropertyAccessFromIndexSignature` | index-signature keys must use `obj["key"]`, not `obj.key` |
| `noImplicitReturns` / `noFallthroughCasesInSwitch` | every path returns; no silent `case` fall-through |
| `noImplicitOverride` | subclass overrides are marked `override` |
| `noUnusedLocals` / `noUnusedParameters` | dead variables, imports and parameters (prefix with `_` when a parameter is required but unused) |

## Idioms

### `noUncheckedIndexedAccess`

```ts
// Destructure and check once, instead of repeating arr[0] everywhere.
const [first] = items;
if (first) use(first);

// Create-if-missing on a record: `??=` returns the entry, typed as defined.
const tally = (byContributor[name] ??= { count: 0 });
tally.count++;

// Test assertions: optional chaining keeps the failure readable.
expect(result.operations[0]?.kind).toBe("payment");
```

Hot numeric code with indices that are in range by construction (e.g.
`src/lib/qrCode.ts`) uses a bounds-checked `at(arr, i)` helper that throws on a
miss, rather than `!` on every access.

### `exactOptionalPropertyTypes`

Leave an optional property out rather than setting it to `undefined`:

```ts
// ✗ { network: wallet.network ?? undefined }
wallet.network ? { network: wallet.network } : {}

// ✗ { key: key ?? undefined }
{ ...(key !== null ? { key } : {}), newValue }
```

When a value may legitimately be absent *or* explicitly `undefined`, declare it
as `x?: T | undefined`.

### `noPropertyAccessFromIndexSignature`

`Record<string, unknown>`, `process.env`, `dataset` and similar are index
signatures: use `val["dstAmount"]`, `document.documentElement.dataset["motion"]`.
Declared properties still use dot access. (Application code reads configuration
from `config` in `src/lib/config.ts`, not `process.env`.)
