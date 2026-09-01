# Security Audit: Client-Side Logging

## Overview

This document outlines the security measures implemented to prevent accidental exposure of sensitive information through client-side console logging.

## Sensitive Data Categories

The application handles the following types of sensitive data that must never be logged to the browser console:

1. **Wallet Addresses** - Stellar addresses (56-character strings starting with 'G')
2. **Private Keys** - Secret keys (56-character strings starting with 'S')
3. **XDR Transaction Blobs** - Serialized transaction data (long base64-like strings)
4. **Backend Error Details** - May contain sensitive API information
5. **Seed Phrases** - User recovery phrases

## Implementation

### Secure Logger Utility

A `secureLogger` utility has been implemented in `src/lib/secureLogging.ts` that provides:

- **Automatic Redaction**: Detects and redacts sensitive patterns in all logged data
- **Pattern Matching**: Uses regex patterns to identify:
  - Stellar addresses (G + 55 alphanumeric characters)
  - Private keys (S + 55 alphanumeric characters)
  - XDR blobs (AAAA + base64 characters)
  - Seed phrases (sequences of common words)

### API

The secure logger provides the same interface as `console`:

```typescript
import { secureLogger } from '@/lib/secureLogging';

// Usage
secureLogger.log('Event', data);      // Logs with redaction
secureLogger.warn('Warning', data);   // Warns with redaction
secureLogger.error('Error', data);    // Errors with redaction
```

### Redaction Examples

**Before:**
```
Error: Failed to submit intent
{ intentId: "intent_abc123", address: "GBUQWP3BOUZX34ULNQG23RQ6F4YUSXHTWYTTE2XYGDWKIUZQVHAEDO74", xdr: "AAAAAgAAAABgSvLU8OZaKKAx7BRgZQ5s76q5xOE1..." }
```

**After:**
```
Error: Failed to submit intent
{ intentId: "intent_abc123", address: "[REDACTED]", xdr: "[REDACTED]..." }
```

## Audit Findings

### Audit Date
- Initial audit: 2026-08-31
- Scanner: Automated grep for `console.*` calls

### Files Reviewed
1. `src/hooks/useSwapSubmission.ts` - Uses error messages only (no sensitive data)
2. `src/hooks/useSolverRegistration.ts` - Uses error messages only (no sensitive data)
3. `src/lib/api.ts` - Uses error messages only (no sensitive data)
4. `src/lib/i18n-legacy.ts` - Updated to use secureLogger ✓

### Remediation Status
- [x] Secure logging utility created
- [x] Tests added for redaction logic
- [x] i18n-legacy.ts updated to use secureLogger
- [x] Documentation created

## Guidelines for Contributors

When logging data in this application:

1. **Never log raw sensitive data** to console without redaction
2. **Always use `secureLogger`** instead of `console` for any data that might contain:
   - User wallet addresses
   - Transaction details
   - API responses with sensitive fields
3. **Review logs during debugging** to ensure no unredacted sensitive data appears
4. **Test your logging** with the `secureLogging.test.ts` suite

## Future Considerations

- Monitor for additional sensitive patterns to redact
- Consider error reporting integration (e.g., Sentry) with redaction hooks
- Periodic audits of logging statements during code reviews

---

# Security Audit: Environment Variable Exposure

## Overview

Next.js automatically inlines all `NEXT_PUBLIC_*` environment variables into the client bundle at build time. While this is necessary for publicly-accessible configuration, it creates a risk: if a sensitive value (API key, token, secret) is accidentally prefixed with `NEXT_PUBLIC_`, it will be permanently embedded in the browser bundle and exposed to all clients.

## The Problem

Without validation, a well-intentioned but uninformed contributor could write:

```bash
NEXT_PUBLIC_BACKEND_SECRET=my-secret-key  # ❌ DANGER: Now in client bundle!
```

This would be baked into every deployment, potentially compromising the application.

## Solution

A validation utility (`src/lib/envValidation.ts`) provides:

- **Pattern Detection**: Flags `NEXT_PUBLIC_*` variables matching suspicious keywords
- **Build-Time Enforcement**: Validation can be called during the build process
- **Clear Error Messages**: Guides contributors on the issue and resolution

### Suspicious Patterns

The validator flags these patterns in `NEXT_PUBLIC_*` variable names:

- `SECRET` - `NEXT_PUBLIC_API_SECRET` ❌
- `KEY` - `NEXT_PUBLIC_PRIVATE_KEY` ❌
- `TOKEN` - `NEXT_PUBLIC_AUTH_TOKEN` ❌
- `PASSWORD` - `NEXT_PUBLIC_DB_PASSWORD` ❌
- `PRIVATE` - `NEXT_PUBLIC_PRIVATE_DATA` ❌
- `CREDENTIAL` - `NEXT_PUBLIC_CREDENTIAL` ❌
- `BEARER` - `NEXT_PUBLIC_BEARER_TOKEN` ❌

### Safe Variables

These are acceptable as `NEXT_PUBLIC_*`:

- `NEXT_PUBLIC_API_URL=http://localhost:4000` ✓
- `NEXT_PUBLIC_WS_URL=ws://localhost:4000/ws` ✓
- `NEXT_PUBLIC_NETWORK=testnet` ✓
- `NEXT_PUBLIC_RELAY_HOST=relay.example.com` ✓

## Implementation

### Validation API

```typescript
import { validatePublicEnvVariables, enforcePublicEnvValidation } from '@/lib/envValidation';

// Check for issues (returns array of errors)
const errors = validatePublicEnvVariables(process.env);
if (errors.length > 0) {
  console.error('Environment variable issues found:', errors);
}

// Enforce validation (throws if issues found)
enforcePublicEnvValidation(process.env);
```

### Build Integration

The validation can be integrated into the build process by calling `enforcePublicEnvValidation()` in:

- Pre-build scripts
- Next.js config hooks
- CI/CD pipelines
- Pre-commit hooks

### Example: next.config.js

```javascript
const { enforcePublicEnvValidation } = require('./src/lib/envValidation');

enforcePublicEnvValidation(process.env);

module.exports = {
  // ... rest of Next.js config
};
```

## Test Coverage

The utility includes comprehensive tests in `src/lib/envValidation.test.ts`:

- Pattern detection for all suspicious keywords
- Case-insensitive matching
- Validation of multiple variables
- Error message verification
- Test coverage for edge cases

## Guidelines for Contributors

### DO ✓

- Use `NEXT_PUBLIC_` only for truly public configuration
- Keep API URLs, hostnames, and network identifiers as public config
- Review the `.env.example` file for acceptable variable names
- Run validation before committing environment variable changes

### DON'T ❌

- Never prefix secrets, keys, tokens, or credentials with `NEXT_PUBLIC_`
- Never put API keys, passwords, or private data in any environment variable visible in source control
- Don't ignore validation warnings during development
- Don't commit actual `.env` files (use `.env.example` instead)

## What Constitutes a Secret?

If you wouldn't paste it into a public Slack channel, it's a secret. This includes:

**Assessment:** Safe from XSS. React automatically escapes all text content rendered via JSX (`{expression}`), preventing XSS. No sanitization change is needed for XSS.

**Note:** While safe from XSS, these surfaces are susceptible to Unicode visual-spoofing attacks — see Issue #247 mitigation below.

## Future Considerations

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
