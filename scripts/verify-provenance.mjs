#!/usr/bin/env node
/**
 * npm provenance/signature verification (Issue #480).
 *
 * Runs `npm audit signatures` to verify dependency provenance and
 * attestations. Packages without attestations are checked against
 * a documented allowlist.
 *
 * Usage:
 *   node scripts/verify-provenance.mjs
 *
 * Exit codes:
 *   0 — all signatures valid or allowlisted
 *   1 — invalid signatures or non-allowlisted packages without attestations
 */

import { execSync } from "child_process";
import { join, resolve } from "path";
import { fileURLToPath } from "url";

const __dirname = fileURLToPath(new URL(".", import.meta.url));
const ROOT = join(__dirname, "..");

// Packages that legitimately lack npm attestations (e.g., private packages,
// legacy packages). Reviewed quarterly; documented here per policy.
export const ATTESTATION_ALLOWLIST = new Set([
  // Add package names that legitimately lack attestations here.
  // Example: "@org/internal-pkg"
]);

/**
 * Run `npm audit signatures` and parse the output.
 * Returns the parsed JSON result, or an error object.
 */
export function runAuditSignatures() {
  try {
    const output = execSync("npm audit signatures --json", {
      encoding: "utf-8",
      cwd: ROOT,
      timeout: 120_000,
    });
    return JSON.parse(output);
  } catch (err) {
    // npm audit signatures exits non-zero when issues are found.
    // Try to parse the output from stderr or stdout.
    const output = err.stdout ?? err.stderr ?? "";
    try {
      return JSON.parse(output);
    } catch {
      return { error: output };
    }
  }
}

/**
 * Parse the result of `npm audit signatures` into categorized lists.
 * @param {Record<string, unknown>} result
 * @returns {{ valid: string[], invalid: string[], missing: string[] }}
 */
export function parseAuditResults(result) {
  const valid = [];
  const invalid = [];
  const missing = [];

  if (result.error) {
    return { valid, invalid, missing: ["(unable to run npm audit signatures)"] };
  }

  const sigInfo = result.signatureInfo ?? result.vulnerabilities ?? result;

  if (Array.isArray(sigInfo)) {
    for (const entry of sigInfo) {
      const name = entry.name ?? entry.package ?? "";
      const sigStatus = entry.signatureStatus ?? entry.status ?? "";
      if (sigStatus === "valid") {
        valid.push(name);
      } else if (sigStatus === "missing") {
        missing.push(name);
      } else {
        invalid.push(name);
      }
    }
  } else if (typeof sigInfo === "object" && sigInfo !== null) {
    for (const [name, info] of Object.entries(sigInfo)) {
      if (typeof info === "object" && info !== null) {
        const status = info.signatureStatus ?? info.status ?? "";
        if (status === "valid") {
          valid.push(name);
        } else if (status === "missing") {
          missing.push(name);
        } else {
          invalid.push(name);
        }
      }
    }
  }

  return { valid, invalid, missing };
}

/**
 * Check for non-allowlisted packages missing attestations.
 * @param {string[]} missing
 * @returns {string[]}
 */
export function checkAllowlist(missing) {
  return missing.filter((name) => !ATTESTATION_ALLOWLIST.has(name));
}

function main() {
  console.log("🔍 Verifying dependency provenance and signatures...");

  const result = runAuditSignatures();
  const { valid, invalid, missing } = parseAuditResults(result);

  // Check for invalid signatures — these always fail
  if (invalid.length > 0) {
    console.error(`❌ ${invalid.length} package(s) with invalid signatures:\n`);
    for (const name of invalid) {
      console.error(`  • ${name}`);
    }
    process.exit(1);
  }

  // Check for missing attestations — allowlisted ones are OK
  const nonAllowlistedMissing = checkAllowlist(missing);
  if (nonAllowlistedMissing.length > 0) {
    console.error(
      `❌ ${nonAllowlistedMissing.length} package(s) missing attestations and not on the allowlist:\n`
    );
    for (const name of nonAllowlistedMissing) {
      console.error(`  • ${name}`);
    }
    console.error(
      "\nIf these packages legitimately lack attestations, add them to ATTESTATION_ALLOWLIST in scripts/verify-provenance.mjs."
    );
    process.exit(1);
  }

  if (missing.length > 0) {
    console.log(
      `ℹ️  ${missing.length} package(s) missing attestations (allowlisted): ${missing.join(", ")}`
    );
  }

  console.log(
    `✅ Provenance checks passed. ${valid.length} valid signature(s) verified.`
  );
  process.exit(0);
}

// Only run main() when this file is executed directly, not when imported as a module.
if (import.meta.url === `file://${process.argv[1]}`) {
  main();
}
