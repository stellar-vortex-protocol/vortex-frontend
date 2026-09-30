#!/usr/bin/env node
/**
 * CycloneDX SBOM generator for production dependencies.
 *
 * Produces a CycloneDX JSON SBOM (version 1.6) for the project's
 * production (non-dev) dependencies and writes it to the given path
 * (defaults to sbom.json in the project root).
 *
 * Usage:
 *   node scripts/generate-sbom.mjs [output-path]
 *
 * Exit codes:
 *   0 — SBOM generated successfully
 *   1 — unable to read package.json or package-lock.json
 */

import { readFileSync, writeFileSync } from "fs";
import { join, resolve } from "path";
import { fileURLToPath } from "url";

const __dirname = fileURLToPath(new URL(".", import.meta.url));
const ROOT = join(__dirname, "..");

const OUTPUT_PATH = resolve(
  process.argv[2] || join(ROOT, "sbom.json")
);

// Approved registry hosts for SBOM component resolution.
export const APPROVED_REGISTRIES = new Set([
  "registry.npmjs.org",
]);

/**
 * Read and parse a JSON file, returning null on failure.
 * @param {string} path
 * @returns {Record<string, unknown> | null}
 */
export function readJson(path) {
  try {
    return JSON.parse(readFileSync(path, "utf8"));
  } catch {
    return null;
  }
}

/**
 * Extract production dependency names from package.json.
 * @param {Record<string, unknown>} pkg
 * @returns {Set<string>}
 */
export function getProductionDeps(pkg) {
  const deps = new Set();
  const dependencies = pkg.dependencies;
  if (dependencies && typeof dependencies === "object") {
    for (const name of Object.keys(dependencies)) {
      deps.add(name);
    }
  }
  return deps;
}

/**
 * Build a CycloneDX component object from a lockfile entry.
 * @param {string} name
 * @param {string} version
 * @param {string} [license]
 * @returns {object}
 */
export function buildComponent(name, version, license) {
  const component = {
    type: "library",
    name,
    version,
  };
  if (license) {
    component.licenses = [{ license: { name: license } }];
  }
  return component;
}

/**
 * Walk the lockfile packages and collect production dependency metadata.
 * @param {Record<string, unknown>} lockfile
 * @param {Set<string>} prodDeps
 * @returns {object[]}
 */
export function collectComponents(lockfile, prodDeps) {
  const packages = lockfile.packages ?? {};
  const components = [];

  for (const [pkgPath, info] of Object.entries(packages)) {
    // Skip the root package
    if (pkgPath === "") continue;

    // Only include top-level production dependencies (not nested node_modules)
    const match = pkgPath.match(/^node_modules\/(.+)$/);
    if (!match) continue;

    const name = match[1];
    // Skip transitive dependencies (those nested deeper like node_modules/foo/node_modules/bar)
    if (name.includes("/node_modules/")) continue;

    // Skip dev-only packages
    if (info.dev === true && !prodDeps.has(name)) continue;

    const version = info.version ?? "";
    const license = info.license ?? "";
    components.push(buildComponent(name, version, license));
  }

  return components;
}

/**
 * Generate a CycloneDX SBOM object.
 * @param {Record<string, unknown>} pkg
 * @param {Record<string, unknown>} lockfile
 * @returns {object}
 */
export function generateSbom(pkg, lockfile) {
  if (lockfile.lockfileVersion !== 3) {
    throw new Error(
      `Unsupported lockfile version ${lockfile.lockfileVersion}. Expected lockfileVersion 3.`
    );
  }

  const prodDeps = getProductionDeps(pkg);
  const components = collectComponents(lockfile, prodDeps);

  return {
    bomFormat: "CycloneDX",
    specVersion: "1.6",
    serialNumber: `urn:uuid:${crypto.randomUUID()}`,
    version: 1,
    metadata: {
      component: {
        type: "application",
        name: pkg.name ?? "vortex-frontend",
        version: pkg.version ?? "0.1.0",
      },
    },
    components,
  };
}

function main() {
  const pkg = readJson(join(ROOT, "package.json"));
  if (!pkg) {
    console.error("ERROR: Could not read package.json");
    process.exit(1);
  }

  const lockfile = readJson(join(ROOT, "package-lock.json"));
  if (!lockfile) {
    console.error("ERROR: Could not read package-lock.json");
    process.exit(1);
  }

  try {
    const sbom = generateSbom(pkg, lockfile);
    writeFileSync(OUTPUT_PATH, JSON.stringify(sbom, null, 2));
    console.log(
      `✅ SBOM written to ${OUTPUT_PATH} (${sbom.components.length} components)`
    );
  } catch (err) {
    console.error(`ERROR: ${err.message}`);
    process.exit(1);
  }

  process.exit(0);
}

// Only run main() when this file is executed directly, not when imported as a module.
if (import.meta.url === `file://${process.argv[1]}`) {
  main();
}
