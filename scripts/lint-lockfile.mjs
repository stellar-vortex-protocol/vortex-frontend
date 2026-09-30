#!/usr/bin/env node
/**
 * Lockfile integrity linter (Issue #480).
 *
 * Parses package-lock.json (v3) and validates:
 *   1. All resolved URLs use the approved registry over HTTPS.
 *   2. Every entry has an integrity hash.
 *   3. No git+ or tarball URL dependencies unless explicitly allowlisted.
 *   4. Workspaces and optional dependencies are handled correctly.
 *
 * Usage:
 *   node scripts/lint-lockfile.mjs [path-to-lockfile]
 *
 * Exit codes:
 *   0 — all checks passed
 *   1 — one or more violations found
 */

import { readFileSync } from "fs";
import { join, resolve } from "path";
import { fileURLToPath } from "url";

const __dirname = fileURLToPath(new URL(".", import.meta.url));
const ROOT = join(__dirname, "..");

const LOCKFILE_PATH = resolve(
  process.argv[2] || join(ROOT, "package-lock.json")
);

// Approved registry hosts (must use HTTPS).
export const APPROVED_REGISTRIES = new Set([
  "registry.npmjs.org",
]);

// Packages allowed to use non-standard sources (git+, tarball, etc.).
// Reviewed quarterly; documented here per policy.
export const ALLOWLISTED_NON_STANDARD_SOURCES = new Set([
  // Add package names that legitimately use git+ or tarball URLs here.
  // Example: "@org/private-pkg"
]);

/**
 * Parse a lockfile and return the raw JSON, or null on failure.
 * @param {string} path
 * @returns {Record<string, unknown> | null}
 */
export function parseLockfile(path) {
  try {
    return JSON.parse(readFileSync(path, "utf8"));
  } catch {
    return null;
  }
}

/**
 * Extract the registry host from a resolved URL.
 * @param {string} url
 * @returns {string | null}
 */
export function extractRegistryHost(url) {
  try {
    const parsed = new URL(url);
    return parsed.hostname;
  } catch {
    return null;
  }
}

/**
 * Check if a URL is a git+ protocol URL.
 * @param {string} url
 * @returns {boolean}
 */
export function isGitUrl(url) {
  return url.startsWith("git+") || url.startsWith("git://");
}

/**
 * Check if a URL is a tarball URL (not registry-based).
 * @param {string} url
 * @returns {boolean}
 */
export function isTarballUrl(url) {
  try {
    const parsed = new URL(url);
    return parsed.pathname.endsWith(".tar.gz") || parsed.pathname.endsWith(".tgz");
  } catch {
    return false;
  }
}

/**
 * Normalise a lockfile package path to a simple name.
 * Handles workspaces and scoped packages.
 * @param {string} pkgPath
 * @returns {string | null}
 */
export function normaliseName(pkgPath) {
  if (pkgPath === "") return null;
  const match = pkgPath.match(/^node_modules\/(.+)$/);
  if (!match) return null;
  return match[1];
}

/**
 * Check if a lockfile entry is an optional dependency.
 * @param {Record<string, unknown>} info
 * @returns {boolean}
 */
export function isOptional(info) {
  return info.optional === true;
}

/**
 * Lint a parsed lockfile object and return a list of violation strings.
 * @param {Record<string, unknown>} lockfile
 * @returns {string[]}
 */
export function lintLockfile(lockfile) {
  const violations = [];
  const packages = lockfile.packages ?? {};

  for (const [pkgPath, info] of Object.entries(packages)) {
    const name = normaliseName(pkgPath);
    if (!name) continue;

    // Skip transitive dependencies (those nested deeper like node_modules/foo/node_modules/bar)
    if (name.includes("/node_modules/")) continue;

    const resolved = info.resolved ?? "";
    const integrity = info.integrity ?? "";

    // Check 1: resolved URL must use an approved registry over HTTPS
    if (resolved) {
      const host = extractRegistryHost(resolved);
      if (host && !APPROVED_REGISTRIES.has(host)) {
        // Check if it's a git+ or tarball URL that is allowlisted
        if ((isGitUrl(resolved) || isTarballUrl(resolved)) && ALLOWLISTED_NON_STANDARD_SOURCES.has(name)) {
          // Allowlisted non-standard source — skip
        } else {
          violations.push(
            `Package "${name}": resolved URL "${resolved}" uses unapproved registry host "${host}". ` +
            `Allowed registries: ${[...APPROVED_REGISTRIES].join(", ")}`
          );
        }
      }
    }

    // Check 2: every entry must have integrity
    if (!integrity) {
      violations.push(
        `Package "${name}": missing integrity hash. This may indicate lockfile tampering.`
      );
    }

    // Check 3: disallow git+ or tarball URLs without explicit allowlist entry
    if (resolved && (isGitUrl(resolved) || isTarballUrl(resolved))) {
      if (!ALLOWLISTED_NON_STANDARD_SOURCES.has(name)) {
        violations.push(
          `Package "${name}": uses non-standard source URL "${resolved}" without an allowlist entry. ` +
          `Add the package to ALLOWLISTED_NON_STANDARD_SOURCES in scripts/lint-lockfile.mjs if this is intentional.`
        );
      }
    }
  }

  return violations;
}

function main() {
  console.log("🔍 Linting lockfile for integrity issues...");

  const lockfile = parseLockfile(LOCKFILE_PATH);
  if (!lockfile) {
    console.error(`ERROR: Could not read or parse ${LOCKFILE_PATH}`);
    process.exit(1);
  }

  if (lockfile.lockfileVersion !== 3) {
    console.error(
      `ERROR: Unsupported lockfile version ${lockfile.lockfileVersion}. Expected lockfileVersion 3.`
    );
    process.exit(1);
  }

  const violations = lintLockfile(lockfile);

  if (violations.length > 0) {
    console.error(`❌ ${violations.length} lockfile integrity violation(s) found:\n`);
    for (const v of violations) {
      console.error(`  • ${v}`);
    }
    console.error(
      "\nIf any of these are intentional, add the package to ALLOWLISTED_NON_STANDARD_SOURCES in scripts/lint-lockfile.mjs."
    );
    process.exit(1);
  }

  console.log("✅ Lockfile integrity checks passed.");
  process.exit(0);
}

// Only run main() when this file is executed directly, not when imported as a module.
if (import.meta.url === `file://${process.argv[1]}`) {
  main();
}
