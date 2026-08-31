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

- API keys and bearer tokens
- Database passwords
- Private cryptographic keys
- Session tokens
- Access credentials of any kind
- Anything marked "Private", "Secret", or "Credential"

## Future Considerations

- Automate validation as part of CI/CD pipeline
- Add pre-commit hooks to check new environment variables
- Monitor for additional suspicious patterns based on incident analysis
- Document approved public configuration patterns per team
