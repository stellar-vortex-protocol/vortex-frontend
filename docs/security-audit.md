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

**Assessment:** Safe from XSS. React automatically escapes all text content rendered via JSX (`{expression}`), preventing XSS. No sanitization change is needed for XSS.

**Note:** While safe from XSS, these surfaces are susceptible to Unicode visual-spoofing attacks — see Issue #247 mitigation below.

## Conclusion

No unsafe rendering sinks were found. The codebase does not use `dangerouslySetInnerHTML`, `eval()`, or dynamic URL construction that bypasses React's built-in sanitization. All externally-sourced strings are rendered safely as plain text by React's default behavior.

---

## Security Mitigations (Issues #244–#247)

### #244 — XDR Transaction Review Before Freighter Signing

**Risk:** Blind signing. The backend relay constructs the transaction XDR and the frontend previously passed it straight to Freighter for signing, with no client-side validation that the encoded transaction matched what the user intended to sign. A compromised or buggy relay could cause a user to sign a transaction with different amounts or destinations.

**Mitigation implemented in:** `src/lib/xdrReview.ts`, `src/hooks/useSwapSubmission.ts`, `src/hooks/useSolverRegistration.ts`

**Details:**
- A new `reviewing` status was inserted between `building` and `awaiting-signature` in both hook state machines.
- `decodeXdr()` uses `@stellar/stellar-sdk`'s `TransactionBuilder.fromXDR()` to decode the XDR returned by the relay. Fee-bump transactions are unwrapped to their inner transaction.
- `validateSwapXdr()` cross-checks the decoded destination and amount against the user's submitted params (amount tolerance: ±1% to accommodate stroops rounding). Any mismatch throws `XdrMismatchError`, a hard stop that prevents `freighterApi.signTransaction` from ever being called.
- `validateRegistrationXdr()` applies the same approach to the bond-deposit transaction for solver registration.
- **XDR decode failures are always a hard stop.** We never fall back to signing an XDR that failed to decode.
- Soroban invoke operations cannot be field-validated without full ABI decoding; they are surfaced to the user as a summary for acknowledgement.
- Edge cases handled: fee-bump transactions (unwrapped), network passphrase mismatches (caught by `TransactionBuilder.fromXDR`), multi-operation transactions, null/unknown network (defaults to testnet passphrase).

**Tests:** `src/lib/xdrReview.test.ts` (decode failure, destination mismatch, amount mismatch, tolerance boundary, multi-op, zero-op), `src/hooks/useSwapSubmission.test.ts` and `src/hooks/useSolverRegistration.test.ts` (mismatch blocking, decode failure, happy path now asserts the review step runs).

---

### #245 — CSV Formula Injection Hardening

**Risk:** CSV/formula injection (CWE-1236). `buildIntentsCsv` wrote solver-supplied fields directly into CSV cells without neutralising leading formula-trigger characters (`=`, `+`, `-`, `@`, tab, CR). A malicious solver name like `=HYPERLINK("http://evil.example","click")` would execute as a formula when the exported `.csv` is opened in Excel, Google Sheets, or LibreOffice Calc.

**Mitigation implemented in:** `src/lib/csv.ts`

**Details:**
- `escapeCsv` now detects leading `=`, `+`, `-`, `@`, tab (U+0009), and carriage-return (U+000D) characters using a compiled regex and prefixes any matching value with a leading apostrophe `'` — the standard OWASP-recommended neutralisation for this class of issue.
- The apostrophe causes spreadsheet apps to treat the cell as inert text rather than a formula.
- Formula-injection neutralisation is applied before the existing CSV quoting logic, so values needing both (e.g. `=HYPERLINK(...)` containing a comma) are handled correctly.
- **Tradeoff:** A leading apostrophe causes Excel to display the apostrophe in the formula bar and sorts the field as text rather than a number. All fields currently exported (`id`, `srcChain`, `srcToken`, `srcAmount`, `dstToken`, `solver`, `status`, `createdAt`) are strings in practice, so no numeric semantics are lost. If a genuinely numeric column is added in future, it should be explicitly excluded from this sanitisation path or pre-formatted to avoid the trigger characters.
- The `-` trigger is intentional: while `-1` is a negative number, no currently-exported field is a bare signed number, and the security benefit of neutralising DDE injection via `-2+3+cmd|'/c calc'!A0`-style payloads outweighs the loss of numeric cell type for hypothetical future numeric fields.

**Tests:** `src/lib/csv.test.ts` — explicit cases for each trigger character (`=`, `+`, `-`, `@`, tab, CR), combined injection + CSV-quoting, safe values unchanged.

---

### #246 — Content-Security-Policy and Security Headers

**Risk:** No CSP or security headers were set. The app was embeddable in hostile iframes (clickjacking risk against Freighter wallet-connect/sign flows) and had no defence-in-depth against future introduction of unsafe sinks.

**Mitigation implemented in:** `next.config.mjs`

**Details:**
- Added a `headers()` export that applies the following to all routes (`source: "/(.*)"`).:
  - `Content-Security-Policy`: `default-src 'self'`; `script-src 'self' 'unsafe-inline'`; `connect-src 'self' <API_ORIGIN> <WS_ORIGIN>` (plus `ws://localhost:*` in dev for HMR); `frame-ancestors 'none'`; `upgrade-insecure-requests`.
  - `X-Frame-Options: DENY` — belt-and-suspenders alongside `frame-ancestors 'none'` for browsers with partial CSP support.
  - `X-Content-Type-Options: nosniff` — prevents MIME-type sniffing attacks.
  - `Referrer-Policy: strict-origin-when-cross-origin` — limits referrer leakage to cross-origin requests.
  - `Permissions-Policy: camera=(), microphone=(), geolocation=()` — disables unnecessary browser features.
- **`'unsafe-inline'` tradeoff:** Next.js 14 injects inline hydration scripts that cannot be removed without a nonce-based CSP requiring custom middleware. `'unsafe-inline'` is accepted for this baseline pass; a nonce-based policy is the recommended follow-up. The XSS risk is low given the absence of `dangerouslySetInnerHTML`, `eval`, or dynamic script insertion in this codebase (confirmed by the audit above).
- API and WebSocket origins are read from `process.env` at server start time (not inlined at build time), so they correctly reflect the runtime configuration.
- **Dev mode:** HMR WebSocket traffic on `ws://localhost:*` is whitelisted only when `NODE_ENV === "development"` so the production policy is not weakened.
- **Freighter wallet communication** happens via `window.postMessage` between the page and the browser extension, which is not a network request and requires no CSP allowance.

**Verification:** Run the production build (`npm run build && npm start`) and confirm the headers are present in DevTools → Network → Response Headers for any page. Verify no CSP violations appear in the browser console during the full swap/solve/explore flows.

---

### #247 — Unicode Confusable / Bidi-Override / Zero-Width Character Defense

**Risk:** Unicode visual spoofing. Solver names and address-adjacent strings were displayed without normalisation, allowing bidi-override characters (e.g. U+202E RIGHT-TO-LEFT OVERRIDE) or zero-width characters (U+200B, U+200C, U+200D, U+FEFF) to make a malicious string appear visually identical to a trusted one — a known "address poisoning" attack vector in crypto UIs.

**Mitigation implemented in:** `src/lib/textSafety.ts` (new), applied to all solver name and truncated-address rendering surfaces.

**Details:**
- `sanitizeDisplayText(value: string): string` strips the following code point ranges:
  - Bidi controls: U+202A–U+202E (LRE, RLE, PDF, LRO, RLO) and U+2066–U+2069 (LRI, RLI, FSI, PDI)
  - Zero-width / invisible: U+200B–U+200D (ZWSP, ZWNJ, ZWJ), U+FEFF (BOM / ZWNBS), U+00AD (soft hyphen)
- Stripping (rather than flagging) is the chosen default because there is no legitimate use of these characters in solver names or Stellar addresses. Stripping is transparent to the user and prevents spoofing without requiring UI changes to every consumer.
- Non-Latin scripts (Arabic, CJK, Cyrillic, etc.) are explicitly NOT stripped — this targets control and invisible code points only.
- Applied to: `ActivityFeed.tsx` (solver route display), `CopyButton.tsx` (sanitizes before clipboard write), `ConnectWalletButton.tsx` (truncated wallet address display), `SolvePageClient.tsx` (leaderboard solver names), `solve/[address]/page.tsx` (solver name and truncated address), `explore/[id]/page.tsx` (solver field and truncated addresses), `ExplorePageClient.tsx` (solver via field), `my-intents/page.tsx` (solver via field).
- **Stellar address note:** Stellar public keys are fixed-format 56-character base32 G-strkeys validated structurally by `isValidStellarPublicKey` before any display or form submission. Confusable-character risk is inherently limited there. No address-adjacent free-text field (such as a future memo field) currently bypasses validation, but any future memo or label field must route through `sanitizeDisplayText` before display — this is the expected pattern established by this change.

**Tests:** `src/lib/textSafety.test.ts` — real Unicode attack fixtures for every bidi control (U+202A–U+202E, U+2066–U+2069), every zero-width character (U+200B–U+200D, U+FEFF, U+00AD), combined payloads, safe ASCII/non-Latin strings asserted unchanged.
