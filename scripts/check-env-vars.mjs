#!/usr/bin/env node
/**
 * check-env-vars.mjs
 *
 * Build-time environment check, driven by the same schema as the runtime
 * config (src/lib/env-schema.mjs → src/lib/config.ts). Fails when:
 *
 * - source under src/ reads a process.env variable the schema doesn't define
 * - .env.example repeats a variable, or doesn't list exactly the schema's
 *   variables
 * - the README "Required Environment Variables" table doesn't list exactly
 *   the schema's variables
 * - a set variable is malformed (e.g. unknown network, bad contract ID, or
 *   http:// / ws:// to a non-local host when NODE_ENV=production)
 * - a NEXT_PUBLIC_* variable's name suggests a secret (it would be inlined
 *   into the browser bundle)
 *
 * Usage:
 *   node scripts/check-env-vars.mjs
 */

import { readFileSync, readdirSync, statSync } from "node:fs";
import { join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { ENV_SCHEMA, SUSPICIOUS_PATTERNS, parseEnv } from "../src/lib/env-schema.mjs";

const SCHEMA_NAMES = ENV_SCHEMA.map((v) => v.name);
// Set by Node/Next tooling rather than by the app's own configuration.
const TOOLING_VARS = new Set(["NODE_ENV"]);

/** Variable names assigned in a dotenv file, in order (duplicates kept). */
export function parseDotenvNames(text) {
  const names = [];
  for (const line of text.split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eq = trimmed.indexOf("=");
    if (eq !== -1) names.push(trimmed.slice(0, eq).trim());
  }
  return names;
}

/** Variable names in the first column of the README env table. */
export function parseReadmeEnvTable(readme) {
  const start = readme.indexOf("### Required Environment Variables");
  if (start === -1) return null;
  const names = [];
  for (const line of readme.slice(start).split("\n").slice(1)) {
    if (line.startsWith("#")) break;
    const match = line.match(/^\|\s*`([A-Z0-9_]+)`\s*\|/);
    if (match) names.push(match[1]);
  }
  return names;
}

/** `process.env` variable names referenced in a source file. */
export function findEnvReferences(source) {
  const re = /process\.env(?:\.([A-Z0-9_]+)|\[['"]([A-Z0-9_]+)['"]\])/g;
  return [...source.matchAll(re)].map((m) => m[1] ?? m[2]);
}

function compareToSchema(label, names) {
  const errors = [];
  const seen = new Set();
  for (const name of names) {
    if (seen.has(name)) errors.push(`${label} lists ${name} more than once`);
    seen.add(name);
  }
  for (const name of SCHEMA_NAMES) {
    if (!seen.has(name)) errors.push(`${label} is missing ${name}`);
  }
  for (const name of seen) {
    if (!SCHEMA_NAMES.includes(name)) {
      errors.push(`${label} lists ${name}, which src/lib/env-schema.mjs doesn't define`);
    }
  }
  return errors;
}

/**
 * Runs every check. `inputs` holds the file contents and environment so the
 * checks can be tested without touching disk.
 */
export function checkEnv({ envExample, readme, sources, env, production }) {
  const errors = [];

  for (const { file, text } of sources) {
    for (const name of findEnvReferences(text)) {
      if (!SCHEMA_NAMES.includes(name) && !TOOLING_VARS.has(name)) {
        errors.push(`${file} reads process.env.${name}, which src/lib/env-schema.mjs doesn't define`);
      }
    }
  }

  errors.push(...compareToSchema(".env.example", parseDotenvNames(envExample)));

  const readmeNames = parseReadmeEnvTable(readme);
  if (readmeNames === null) {
    errors.push('README.md has no "### Required Environment Variables" table');
  } else {
    errors.push(...compareToSchema("README env table", readmeNames));
  }

  errors.push(...parseEnv(env, { production }).errors);

  for (const name of Object.keys(env)) {
    if (!name.startsWith("NEXT_PUBLIC_")) continue;
    const pattern = SUSPICIOUS_PATTERNS.find((p) => p.test(name));
    if (pattern) {
      errors.push(
        `${name} contains "${pattern.source}", which suggests a secret; NEXT_PUBLIC_* variables are exposed in the browser`,
      );
    }
  }

  return errors;
}

function walk(dir, out = []) {
  for (const entry of readdirSync(dir)) {
    if (entry.startsWith(".") || entry === "node_modules") continue;
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) walk(full, out);
    else if (/\.(ts|tsx|js|jsx|mjs)$/.test(entry) && !/\.test\./.test(entry)) out.push(full);
  }
  return out;
}

function main() {
  const ROOT = join(fileURLToPath(new URL(".", import.meta.url)), "..");
  const production = process.env.NODE_ENV === "production";
  const errors = checkEnv({
    envExample: readFileSync(join(ROOT, ".env.example"), "utf8"),
    readme: readFileSync(join(ROOT, "README.md"), "utf8"),
    sources: walk(join(ROOT, "src")).map((file) => ({
      file: relative(ROOT, file),
      text: readFileSync(file, "utf8"),
    })),
    env: process.env,
    production,
  });

  if (errors.length > 0) {
    console.error(`❌  Environment check failed (${errors.length} problem(s)):\n`);
    for (const error of errors) console.error(`  - ${error}`);
    console.error("\nSee docs/configuration.md for the variables and how to add one.");
    process.exit(1);
  }
  console.log(
    `✅  ${SCHEMA_NAMES.length} environment variables: .env.example, README and source agree with the schema${
      production ? "; values are valid for production" : ""
    }.`,
  );
}

if (process.argv[1] && fileURLToPath(import.meta.url) === resolve(process.argv[1])) {
  main();
}
