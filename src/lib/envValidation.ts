/**
 * Environment variable validation to prevent accidental exposure of secrets.
 *
 * Next.js inlines all NEXT_PUBLIC_* variables into the client bundle at build time.
 * This utility provides validation to flag suspicious patterns that suggest
 * a sensitive value was accidentally prefixed with NEXT_PUBLIC_.
 */

// Shared with scripts/check-env-vars.mjs, which runs this check at build time.
import { SUSPICIOUS_PATTERNS } from "./env-schema.mjs";

export interface EnvValidationError {
  variable: string;
  pattern: RegExp;
  message: string;
}

/**
 * Check if an environment variable name contains suspicious patterns
 * that suggest it contains sensitive data that shouldn't be public.
 */
export function checkSuspiciousPattern(variableName: string): RegExp | null {
  for (const pattern of SUSPICIOUS_PATTERNS) {
    if (pattern.test(variableName)) {
      return pattern;
    }
  }
  return null;
}

/**
 * Validate all NEXT_PUBLIC_* environment variables.
 * Raises an error if any NEXT_PUBLIC_ variable matches a suspicious pattern.
 */
export function validatePublicEnvVariables(env: Record<string, string | undefined>): EnvValidationError[] {
  const errors: EnvValidationError[] = [];

  for (const key of Object.keys(env)) {
    if (!key.startsWith("NEXT_PUBLIC_")) {
      continue;
    }

    const suspiciousPattern = checkSuspiciousPattern(key);
    if (suspiciousPattern) {
      errors.push({
        variable: key,
        pattern: suspiciousPattern,
        message: `Environment variable "${key}" contains "${suspiciousPattern.source}" which suggests it may contain sensitive data. NEXT_PUBLIC_* variables are bundled into the client and exposed in the browser. If this is intentional, rename the variable to remove the suspicious keyword.`,
      });
    }
  }

  return errors;
}

/**
 * Validate environment variables and throw an error if issues are found.
 * Should be called during build time.
 */
export function enforcePublicEnvValidation(env: Record<string, string | undefined>): void {
  const errors = validatePublicEnvVariables(env);

  if (errors.length > 0) {
    const messages = errors.map(e => `  • ${e.message}`).join("\n");
    throw new Error(
      `Environment Variable Security Check Failed:\n\n${messages}\n\n` +
      `See docs/security-audit.md for guidelines on environment variables.`
    );
  }
}

/**
 * Get a list of all NEXT_PUBLIC_* variables for audit purposes.
 */
export function getPublicEnvVariables(env: Record<string, string | undefined>): string[] {
  return Object.keys(env)
    .filter(key => key.startsWith("NEXT_PUBLIC_"))
    .sort();
}
