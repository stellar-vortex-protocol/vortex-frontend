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
