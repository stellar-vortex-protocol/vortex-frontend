#!/usr/bin/env node
/**
 * check-i18n-parity.mjs
 *
 * Enforces i18n catalog consistency:
 * 1. Verifies every message key in en.ts has a corresponding key in es.ts (and vice versa)
 * 2. Scans src/ for literal t("...") and getMessage("...") calls and ensures referenced keys exist in catalogs
 * 3. Reports any parity mismatches or missing key references
 * 4. Validates ICU plural/select placeholders, plural categories per locale,
 *    empty strings, and max length ratios across all locale catalogs
 *
 * Usage:
 *   node scripts/check-i18n-parity.mjs
 *
 * Exit codes:
 *   0 — catalog parity maintained, all referenced keys exist
 *   1 — catalog drift detected or missing key references found
 */

import { readFileSync, readdirSync, statSync, existsSync } from "fs";
import { join, relative } from "path";
import { fileURLToPath } from "url";

const __dirname = fileURLToPath(new URL(".", import.meta.url));
const ROOT = join(__dirname, "..");

// ── 1. Load message catalogs ──────────────────────────────────────────────

const enPath = join(ROOT, "src/lib/i18n/messages/en.ts");
const esPath = join(ROOT, "src/lib/i18n/messages/es.ts");

// Additional locale catalogs added for issue #495. Missing files are skipped
// gracefully so the script keeps working before/after the catalogs land.
const EXTRA_LOCALES = [
  { locale: "pt-BR", path: join(ROOT, "src/lib/i18n/messages/pt-BR.ts") },
  { locale: "fr", path: join(ROOT, "src/lib/i18n/messages/fr.ts") },
  { locale: "zh-CN", path: join(ROOT, "src/lib/i18n/messages/zh-CN.ts") },
];

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

/**
 * Extract key → raw message value pairs from a catalog file.
 * Handles single-line string values (the catalog convention).
 *
 * @param {string} content
 * @returns {Map<string, string>}
 */
function extractMessageValues(content) {
  const values = new Map();
  const valueRegex = /"([a-z][a-z0-9]*(?:\.[a-z][a-z0-9]*)*)"\s*:\s*"((?:[^"\\]|\\.)*)"/g;
  let match;
  while ((match = valueRegex.exec(content)) !== null) {
    values.set(match[1], match[2]);
  }
  return values;
}

const enKeys = extractMessageKeys(enContent);
const esKeys = extractMessageKeys(esContent);
const enValues = extractMessageValues(enContent);

// ── 2. Check catalog parity ───────────────────────────────────────────────

const errors = [];

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

// ── 5. ICU placeholder / plural validation ────────────────────────────────

/**
 * Extract simple `{name}` placeholders from a message, ignoring ICU plural
 * and select blocks (which are validated separately).
 *
 * @param {string} message
 * @returns {Set<string>}
 */
function extractPlaceholders(message) {
  const names = new Set();
  // Strip ICU plural/select blocks so their inner placeholders are handled
  // by the plural validator instead of the simple placeholder extractor.
  const stripped = message.replace(/\{[^{}]*,\s*(?:plural|select|selectordinal)\s*,[^{}]*\{[^{}]*\}[^{}]*\}/g, "");
  const re = /\{\s*([a-zA-Z_][a-zA-Z0-9_]*)\s*(?:,\s*(?:number|date|time)\b[^{}]*)?\}/g;
  let m;
  while ((m = re.exec(stripped)) !== null) {
    names.add(m[1]);
  }
  return names;
}

/**
 * Parse ICU plural/select blocks from a message.
 * Returns an array of { argName, type, categories } where categories is a
 * Set of branch keys (e.g. "one", "other", "=0").
 *
 * @param {string} message
 * @returns {Array<{argName: string, type: string, categories: Set<string>}>}
 */
function extractPluralBlocks(message) {
  const blocks = [];
  const re = /\{\s*([a-zA-Z_][a-zA-Z0-9_]*)\s*,\s*(plural|select|selectordinal)\s*,/g;
  let m;
  while ((m = re.exec(message)) !== null) {
    const argName = m[1];
    const type = m[2];
    // Find the matching closing brace for this block.
    let depth = 1;
    let i = re.lastIndex;
    const categories = new Set();
    let branchBuf = "";
    let branchName = null;
    while (i < message.length && depth > 0) {
      const ch = message[i];
      if (ch === "{") {
        depth++;
        if (depth === 2) {
          // entering a branch body; branchName already captured
        }
        branchBuf += ch;
      } else if (ch === "}") {
        depth--;
        if (depth === 1 && branchName !== null) {
          categories.add(branchName);
          branchName = null;
          branchBuf = "";
        }
        branchBuf += ch;
      } else {
        branchBuf += ch;
      }
      i++;
    }
    // Simpler category extraction: scan for `category {` patterns.
    const catRe = /(?:^|\s)(=?-?\d+|[a-zA-Z]+)\s*\{/g;
    let cm;
    while ((cm = catRe.exec(message.slice(m.index, i))) !== null) {
      categories.add(cm[1]);
    }
    blocks.push({ argName, type, categories });
    re.lastIndex = i;
  }
  return blocks;
}

/**
 * Validate a message's ICU structure and return a list of problems.
 *
 * @param {string} key
 * @param {string} message
 * @param {string} locale
 * @returns {string[]}
 */
function validateMessage(key, message, locale) {
  const problems = [];

  if (message.trim() === "") {
    problems.push(`empty string for key "${key}"`);
    return problems;
  }

  // Brace balance check.
  let depth = 0;
  for (const ch of message) {
    if (ch === "{") depth++;
    else if (ch === "}") depth--;
    if (depth < 0) break;
  }
  if (depth !== 0) {
    problems.push(`unbalanced braces in key "${key}"`);
  }

  const blocks = extractPluralBlocks(message);
  for (const block of blocks) {
    if (block.type === "plural" || block.type === "selectordinal") {
      if (!block.categories.has("other")) {
        problems.push(`plural block "${block.argName}" in key "${key}" is missing required "other" branch`);
      }
      // Validate categories against Intl.PluralRules for the locale.
      let validCategories;
      try {
        const pr = new Intl.PluralRules(locale);
        validCategories = new Set(pr.resolvedOptions().pluralCategories);
      } catch {
        validCategories = null;
      }
      if (validCategories) {
        for (const cat of block.categories) {
          if (cat.startsWith("=")) continue; // exact matches are always valid
          if (!validCategories.has(cat)) {
            problems.push(`plural category "${cat}" in key "${key}" is not valid for locale "${locale}"`);
          }
        }
      }
    } else if (block.type === "select") {
      if (!block.categories.has("other")) {
        problems.push(`select block "${block.argName}" in key "${key}" is missing required "other" branch`);
      }
    }
  }

  return problems;
}

// ── 6. Cross-locale placeholder parity + length ratio ─────────────────────

const MAX_LENGTH_RATIO = 2.5; // warn when a translation is >2.5x the English length

/**
 * Compare placeholders for a key across locales.
 * @param {string} key
 * @param {Map<string, string>} enVals
 * @param {Map<string, string>} otherVals
 * @param {string} locale
 * @returns {string[]}
 */
function checkPlaceholderParity(key, enVals, otherVals, locale) {
  const problems = [];
  const enMsg = enVals.get(key);
  const otherMsg = otherVals.get(key);
  if (enMsg === undefined || otherMsg === undefined) return problems;

  const enPh = extractPlaceholders(enMsg);
  const otherPh = extractPlaceholders(otherMsg);

  for (const name of enPh) {
    if (!otherPh.has(name)) {
      problems.push(`key "${key}" in ${locale} is missing placeholder {${name}}`);
    }
  }
  for (const name of otherPh) {
    if (!enPh.has(name)) {
      problems.push(`key "${key}" in ${locale} has extra placeholder {${name}} not present in en`);
    }
  }

  // Plural argument parity.
  const enArgs = new Set(extractPluralBlocks(enMsg).map(b => b.argName));
  const otherArgs = new Set(extractPluralBlocks(otherMsg).map(b => b.argName));
  for (const name of enArgs) {
    if (!otherArgs.has(name)) {
      problems.push(`key "${key}" in ${locale} is missing plural/select argument {${name}}`);
    }
  }
  for (const name of otherArgs) {
    if (!enArgs.has(name)) {
      problems.push(`key "${key}" in ${locale} has extra plural/select argument {${name}} not present in en`);
    }
  }

  return problems;
}

// ── 7. Report results ────────────────────────────────────────────────────

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

// Validate the English catalog itself (source of truth).
const enValidationProblems = [];
for (const [key, msg] of enValues) {
  for (const p of validateMessage(key, msg, "en")) {
    enValidationProblems.push(p);
  }
}
if (enValidationProblems.length > 0) {
  errors.push({
    type: "invalid-message",
    severity: "critical",
    message: `${enValidationProblems.length} invalid message(s) in en.ts`,
    problems: enValidationProblems,
  });
}

// Validate extra locales (pt-BR, fr, zh-CN) when present.
const lengthWarnings = [];
for (const { locale, path } of EXTRA_LOCALES) {
  if (!existsSync(path)) continue;
  const content = readFileSync(path, "utf8");
  const keys = extractMessageKeys(content);
  const values = extractMessageValues(content);

  const missing = [...enKeys].filter(k => !keys.has(k));
  const extra = [...keys].filter(k => !enKeys.has(k));
  if (missing.length > 0) {
    errors.push({
      type: "catalog-drift",
      severity: "critical",
      message: `${missing.length} key(s) in en.ts but missing from ${locale}.ts`,
      keys: missing.sort(),
    });
  }
  if (extra.length > 0) {
    errors.push({
      type: "catalog-drift",
      severity: "critical",
      message: `${extra.length} key(s) in ${locale}.ts but missing from en.ts`,
      keys: extra.sort(),
    });
  }

  const validationProblems = [];
  for (const [key, msg] of values) {
    for (const p of validateMessage(key, msg, locale)) {
      validationProblems.push(p);
    }
    for (const p of checkPlaceholderParity(key, enValues, values, locale)) {
      validationProblems.push(p);
    }
    const enMsg = enValues.get(key);
    if (enMsg && enMsg.length > 0 && msg.length / enMsg.length > MAX_LENGTH_RATIO) {
      lengthWarnings.push(
        `key "${key}" in ${locale} is ${(msg.length / enMsg.length).toFixed(1)}x the English length`
      );
    }
  }
  if (validationProblems.length > 0) {
    errors.push({
      type: "invalid-message",
      severity: "critical",
      message: `${validationProblems.length} invalid message(s) in ${locale}.ts`,
      problems: validationProblems,
    });
  }
}

if (errors.length === 0) {
  console.log(
    `✅  i18n catalog parity maintained.\n` +
    `    • English catalog: ${enKeys.size} keys\n` +
    `    • Spanish catalog: ${esKeys.size} keys (synced)\n` +
    `    • Code references: ${usedKeys.size} keys used (all valid)`
  );

  if (lengthWarnings.length > 0) {
    console.log(`\n⚠️  Length ratio warnings (>${MAX_LENGTH_RATIO}x English):`);
    for (const w of lengthWarnings) {
      console.log(`    • ${w}`);
    }
  }

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
  } else if (error.type === "invalid-message") {
    console.error(`  ${error.message}:`);
    for (const problem of error.problems) {
      console.error(`    • ${problem}`);
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
  `  3. Fix invalid ICU messages: ensure plural/select blocks have an "other" branch and valid categories\n` +
  `  4. Re-run: node scripts/check-i18n-parity.mjs`
);

process.exit(1);
