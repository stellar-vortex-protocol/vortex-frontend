/**
 * Secure logging utilities to redact sensitive information from console output.
 * Prevents accidental exposure of wallet addresses, XDR blobs, and backend errors.
 */

const SENSITIVE_PATTERNS = [
  // Stellar addresses (starts with G, typically 56 chars)
  /G[A-Z2-7]{55}/g,
  // Private keys (starts with S, typically 56 chars)
  /S[A-Z2-7]{55}/g,
  // XDR transaction blobs (long base64-like strings starting with AAAA)
  /AAAA[A-Za-z0-9+/=]{50,}/g,
  // Seed phrases (sequences of common words)
  /\b([a-z]+\s+){11}[a-z]+\b/gi,
];

/**
 * Returns true when the value still contains anything that looks like a
 * Stellar address, secret key, XDR blob or seed phrase. Used by telemetry to
 * reject payloads that were not fully scrubbed before leaving the client.
 */
export function containsSensitiveData(value: unknown): boolean {
  if (value === null || value === undefined) return false;

  const str = typeof value === "string" ? value : JSON.stringify(value);
  if (!str) return false;

  return SENSITIVE_PATTERNS.some((pattern) => {
    // Patterns are global; reset lastIndex so repeated calls stay correct.
    pattern.lastIndex = 0;
    return pattern.test(str);
  });
}

export function redactSensitiveData(value: unknown): string {
  if (value === null || value === undefined) return String(value);

  let str = typeof value === "string" ? value : JSON.stringify(value);

  // Redact all sensitive patterns
  SENSITIVE_PATTERNS.forEach((pattern) => {
    pattern.lastIndex = 0;
    str = str.replace(pattern, "[REDACTED]");
  });

  return str;
}

export function truncateString(value: string, maxLength: number = 50): string {
  if (value.length <= maxLength) return value;
  return `${value.slice(0, maxLength / 2)}...${value.slice(-maxLength / 2)}`;
}

export function createSecureLogger() {
  return {
    log: (message: string, data?: unknown) => {
      const redacted = data ? redactSensitiveData(data) : "";
      console.log(message, redacted);
    },
    warn: (message: string, data?: unknown) => {
      const redacted = data ? redactSensitiveData(data) : "";
      console.warn(message, redacted);
    },
    error: (message: string, data?: unknown) => {
      const redacted = data ? redactSensitiveData(data) : "";
      console.error(message, redacted);
    },
  };
}

export const secureLogger = createSecureLogger();
