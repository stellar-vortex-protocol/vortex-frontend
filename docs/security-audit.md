# External String Rendering Audit

**Date:** 2026-07-30
**Scope:** Audit of places rendering solver-supplied or externally-sourced strings to confirm they are safely rendered as text and not passed into unsafe sinks.

## Methodology

The codebase was searched for the following risky sinks and patterns:

| Sink/Pattern | Searched Via | Result |
|---|---|---|
| `dangerouslySetInnerHTML` | `grep -rn "dangerouslySetInnerHTML" src/` | **None found** |
| `eval()`, `Function()`, `setTimeout(string)` | `grep -rn "eval(\|Function(\|setTimeout(\|setInterval(" src/` | **None found** |
| Dynamic `src` attributes | Grep for `src={`...${` in `.tsx` files | **None found** |
| Dynamic `href` from external data | Grep for `href={`...${` in `.tsx` files | 1 instance found (see below) |
| `iframe`, `embed`, `object` injection | Grep for sink tags in `.tsx` files | **None found** |
| `window.location` / `document.write` injection | Grep for `window\.` and `document.` in `.tsx` files | **No injection vectors** |

## Finding: Dynamic `href` in `src/app/explore/[id]/page.tsx:81`

```tsx
href={`https://stellar.expert/explorer/${NETWORK}/tx/${intent.txHash}`}
```

**Assessment:** Safe. React sanitizes `href` attributes on `<a>` tags, preventing `javascript:` protocol URLs. The `NETWORK` value comes from environment configuration (not user input). The `intent.txHash` is a Stellar transaction hash supplied by the backend solver — even if manipulated, the link destination is the `stellar.expert` block explorer and the URL is properly formed by React's `href` sanitization. No sanitization change is needed.

## Finding: Solver name rendering

Solver-supplied strings (`solver.name`, `intent.solver`, `item.solver`) are rendered as plain text in JSX across multiple components:

- `src/app/solve/[address]/page.tsx:62` — `{solver.name}`
- `src/app/explore/page.tsx:151` — `{item.solver}`
- `src/app/my-intents/page.tsx:121` — `{item.solver}`
- `src/components/ActivityFeed.tsx:53` — `{item.solver}`
- `src/app/explore/[id]/page.tsx:65` — `["Solver", intent.solver]`

**Assessment:** Safe. React automatically escapes all text content rendered via JSX (`{expression}`), preventing XSS. No sanitization change is needed.

## Conclusion

No unsafe rendering sinks were found. The codebase does not use `dangerouslySetInnerHTML`, `eval()`, or dynamic URL construction that bypasses React's built-in sanitization. All externally-sourced strings are rendered safely as plain text by React's default behavior.