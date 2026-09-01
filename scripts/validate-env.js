#!/usr/bin/env node

/**
 * Build-time environment variable validation script.
 *
 * Prevents accidental exposure of secrets in NEXT_PUBLIC_* variables.
 * Run before build: `node scripts/validate-env.js`
 */

const path = require("path");

// Load environment validation utility
// Note: In production, this would import from the compiled lib
const SUSPICIOUS_PATTERNS = [
  /secret/i,
  /key/i,
  /token/i,
  /password/i,
  /private/i,
  /api_?key/i,
  /bearer/i,
  /credential/i,
  /auth/i,
];

function checkSuspiciousPattern(variableName) {
  for (const pattern of SUSPICIOUS_PATTERNS) {
    if (pattern.test(variableName)) {
      return pattern;
    }
  }
  return null;
}

function validatePublicEnv(env) {
  const errors = [];

  for (const [key, value] of Object.entries(env)) {
    if (!key.startsWith("NEXT_PUBLIC_")) {
      continue;
    }

    const suspiciousPattern = checkSuspiciousPattern(key);
    if (suspiciousPattern) {
      errors.push({
        variable: key,
        pattern: suspiciousPattern.source,
      });
    }
  }

  return errors;
}

function main() {
  const errors = validatePublicEnv(process.env);

  if (errors.length === 0) {
    console.log("✓ Environment variables validated successfully");
    process.exit(0);
  }

  console.error("✗ Environment Variable Security Check Failed\n");

  for (const error of errors) {
    console.error(
      `  • ${error.variable} contains "${error.pattern}" which suggests sensitive data`
    );
  }

  console.error("\nIf these values are intentional, rename the variables to remove the");
  console.error("suspicious keywords. See docs/security-audit.md for guidelines.\n");

  process.exit(1);
}

main();
