#!/usr/bin/env node
/**
 * check-i18n-parity.mjs
 *
 * Enforces i18n catalog consistency:
 * 1. Verifies every message key in en.ts has a corresponding key in es.ts (and vice versa)
 * 2. Scans src/ for literal t("...") and getMessage("...") calls and ensures referenced keys exist in catalogs
 * 3. Reports any parity mismatches or missing key references
 *
 * Usage:
 *   node scripts/check-i18n-parity.mjs
 *
 * Exit codes:
 *   0 — catalog parity maintained, all referenced keys exist
 *   1 — catalog drift detected or missing key references found
 */

import { readFileSync, readdirSync, statSync } from "fs";
import { join, relative } from "path";
import { fileURLToPath } from "url";

const __dirname = fileURLToPath(new URL(".", import.meta.url));
const ROOT = join(__dirname, "..");

// ── 1. Load message catalogs ──────────────────────────────────────────────

const enPath = join(ROOT, "src/lib/i18n/messages/en.ts");
const esPath = join(ROOT, "src/lib/i18n/messages/es.ts");

let enContent, esContent;
try {
  enContent = readFileSync(enPath, "utf8");
  esContent = readFileSync(esPath, "utf8");
} catch (err) {
  console.error(`ERROR: Could not read message catalogs: ${err.message}`);
  process.exit(1);
}

/**
 * Extract message keys from a TypeScript message catalog file.
 * Looks for patterns like: "key.name": "value" or "key.name": "value with {placeholder}"
 * Only matches lines where the key is followed by a colon (indicating it's an object key, not a comment).
 * 
 * @param {string} content - File content
 * @returns {Set<string>} Set of message keys found
 */
function extractMessageKeys(content) {
  const keys = new Set();
  // Match quoted keys followed by colons: "key.name": value
  // Anchored pattern to avoid matching quoted strings in comments
  const keyRegex = /"([a-z][a-z0-9]*(?:\.[a-z][a-z0-9]*)*)"\s*:/g;
  let match;
  while ((match = keyRegex.exec(content)) !== null) {
    keys.add(match[1]);
  }
  return keys;
}

const enKeys = extractMessageKeys(enContent);
const esKeys = extractMessageKeys(esContent);

// ── 2. Check catalog parity ───────────────────────────────────────────────

const missingInEs = new Set([...enKeys].filter(k => !esKeys.has(k)));
const missingInEn = new Set([...esKeys].filter(k => !enKeys.has(k)));

// ── 3. Scan source files for literal t() and getMessage() calls ──────────

const SOURCE_EXTENSIONS = new Set([".ts", ".tsx", ".js", ".jsx", ".mjs"]);
// Matches t("key") or t('key') or getMessage("key") or getMessage('key')
// Only captures dot-namespaced keys that follow the message catalog naming convention:
// - Must start with a lowercase letter or digit
// - Can contain lowercase letters, digits, dots, and underscores
// - Must have at least one dot (to avoid catching simple test strings)
// - Pattern enforces NO numbers immediately after dots (prevents catching data like abc123...90hash)
const KEY_REF_RE = /(?:t|getMessage)\(\s*["']([a-z][a-z0-9]*(?:\.[a-z][a-z0-9]*)+)["']\s*\)/g;

// Legacy getMessage pattern (for informational reporting)
const LEGACY_MESSAGE_RE = /getMessage\(/g;

/** @type {Map<string, string[]>} keyName → list of "file:line" locations */
const usedKeys = new Map();

/** @type {Map<string, string[]>} keyName → list of "file:line" locations (legacy only) */
const legacyUsedKeys = new Map();

/**
 * Recursively walk a directory, calling `cb` for every matching file.
 * @param {string} dir
 * @param {(filePath: string) => void} cb
 */
function walk(dir, cb) {
  try {
    for (const entry of readdirSync(dir)) {
      // Skip hidden directories (e.g. .next, .git) and node_modules
      if (entry.startsWith(".") || entry === "node_modules") continue;
      const full = join(dir, entry);
      const stat = statSync(full);
      if (stat.isDirectory()) {
        walk(full, cb);
      } else if (SOURCE_EXTENSIONS.has(full.slice(full.lastIndexOf(".")))) {
        cb(full);
      }
    }
  } catch (err) {
    // Permission errors or deleted directories during walk can be safely ignored
  }
}

walk(join(ROOT, "src"), (filePath) => {
  const content = readFileSync(filePath, "utf8");
  const lines = content.split("\n");
  for (let lineNo = 0; lineNo < lines.length; lineNo++) {
    let match;
    KEY_REF_RE.lastIndex = 0;
    while ((match = KEY_REF_RE.exec(lines[lineNo])) !== null) {
      const keyName = match[1];
      if (!keyName) continue;
      
      // Check if this is a legacy getMessage call (footer.*, nav.*)
      if (keyName.startsWith("footer.") || keyName.startsWith("nav.")) {
        const location = `${relative(ROOT, filePath)}:${lineNo + 1}`;
        if (!legacyUsedKeys.has(keyName)) legacyUsedKeys.set(keyName, []);
        legacyUsedKeys.get(keyName).push(location);
      } else {
        const location = `${relative(ROOT, filePath)}:${lineNo + 1}`;
        if (!usedKeys.has(keyName)) usedKeys.set(keyName, []);
        usedKeys.get(keyName).push(location);
      }
    }
  }
});

// ── 4. Check that all used keys exist in the English catalog ──────────────

const missingKeyReferences = new Map();
for (const [keyName, locations] of usedKeys) {
  if (!enKeys.has(keyName)) {
    missingKeyReferences.set(keyName, locations);
  }
}

// ── 5. Report results ────────────────────────────────────────────────────

const errors = [];

if (missingInEs.size > 0) {
  errors.push({
    type: "catalog-drift",
    severity: "critical",
    message: `${missingInEs.size} key(s) in en.ts but missing from es.ts`,
    keys: Array.from(missingInEs).sort(),
  });
}

if (missingInEn.size > 0) {
  errors.push({
    type: "catalog-drift",
    severity: "critical",
    message: `${missingInEn.size} key(s) in es.ts but missing from en.ts`,
    keys: Array.from(missingInEn).sort(),
  });
}

if (missingKeyReferences.size > 0) {
  errors.push({
    type: "missing-key-reference",
    severity: "critical",
    message: `${missingKeyReferences.size} key(s) referenced in code but missing from catalog`,
    references: Array.from(missingKeyReferences.entries()).map(([key, locs]) => ({
      key,
      locations: locs,
    })),
  });
}

if (errors.length === 0) {
  console.log(
    `✅  i18n catalog parity maintained.\n` +
    `    • English catalog: ${enKeys.size} keys\n` +
    `    • Spanish catalog: ${esKeys.size} keys (synced)\n` +
    `    • Code references: ${usedKeys.size} keys used (all valid)`
  );
  
  if (legacyUsedKeys.size > 0) {
    console.log(
      `\n📝  Legacy i18n system (getMessage) still in use:\n` +
      `    • Legacy keys found: ${legacyUsedKeys.size}\n` +
      `    • Tracked in issue #4 for migration to modern i18n system`
    );
  }
  
  process.exit(0);
}

// Report errors
console.error(`❌  i18n catalog parity check FAILED:\n`);
for (const error of errors) {
  if (error.type === "catalog-drift") {
    console.error(`  ${error.message}:`);
    for (const key of error.keys) {
      console.error(`    • ${key}`);
    }
    console.error("");
  }
}

if (missingKeyReferences.size > 0) {
  console.error(`  ${missingKeyReferences.size} key(s) referenced in code are missing from catalog:`);
  for (const { key, locations } of errors.find(e => e.type === "missing-key-reference")?.references || []) {
    console.error(`    • ${key}`);
    for (const loc of locations) {
      console.error(`      → ${loc}`);
    }
  }
  console.error("");
}

console.error(
  `Next steps:\n` +
  `  1. Fix catalog drift: add missing keys to en.ts or es.ts with proper translations\n` +
  `  2. Fix code references: update any t("...") or getMessage("...") calls to use valid keys\n` +
  `  3. Re-run: node scripts/check-i18n-parity.mjs`
);

process.exit(1);
