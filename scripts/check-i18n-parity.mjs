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
 * 5. Every translation uses the same {placeholder} tokens as English.
 * 6. JSX in src/app/** and src/components/** has no hard-coded user-facing
 *    text (JSX text, or aria-label / title / placeholder / alt strings),
 *    except entries in scripts/i18n-literal-allowlist.json.
 *
 * Usage:
 *   node scripts/check-i18n-parity.mjs
 */

import { readFileSync, readdirSync, statSync, existsSync } from "node:fs";
import { join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import ts from "typescript";

const USER_FACING_ATTRIBUTES = new Set(["aria-label", "title", "placeholder", "alt"]);

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
  });
  return catalog;
}

/** The {placeholder} names in a message, sorted. */
export function placeholders(message) {
  return [...message.matchAll(/\{(\w+)\}/g)].map((m) => m[1]).sort();
}

/** Parity errors between the English catalog and every other locale. */
export function checkCatalogs(catalogs) {
  const errors = [];
  const en = catalogs.en;
  for (const [locale, catalog] of Object.entries(catalogs)) {
    if (locale === "en") continue;
    for (const key of en.keys()) {
      if (!catalog.has(key)) errors.push(`${locale}: missing key "${key}"`);
    }
    for (const [key, value] of catalog) {
      if (!en.has(key)) {
        errors.push(`${locale}: key "${key}" is not in the English catalog`);
        continue;
      }
      const expected = placeholders(en.get(key)).join(",");
      if (placeholders(value).join(",") !== expected) {
        errors.push(`${locale}: "${key}" uses {${placeholders(value).join("},{")}} but English uses {${expected.split(",").join("},{")}}`);
      }
    }
  }
  return errors;
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
  // by the plural validator in
      }
    }
  }
  return errors;
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

/**
 * t() calls in a source file: literal keys, and calls whose key is a template
 * string with substitutions (reported as dynamic).
 */
export function findKeyReferences(source, fileName) {
  const keys = [];
  const dynamic = [];
  const sf = parse(source, fileName);
  walk(sf, (node) => {
    if (!ts.isCallExpression(node) || !ts.isIdentifier(node.expression) || node.expression.text !== "t") return;
    const [arg] = node.arguments;
    if (!arg) return;
    const line = sf.getLineAndCharacterOfPosition(node.getStart()).line + 1;
    if (ts.isStringLiteral(arg) || ts.isNoSubstitutionTemplateLiteral(arg)) keys.push({ key: arg.text, line });
    else if (ts.isTemplateExpression(arg)) dynamic.push({ text: arg.getText(sf), line });
  });
  return { keys, dynamic };
}

/** Hard-coded user-facing text in the JSX of a source file. */
export function findJsxLiterals(source, fileName, allowed = new Set()) {
  const found = [];
  const sf = parse(source, fileName);
  const report = (text, node) => {
    const value = text.replace(/\s+/g, " ").trim();
    if (!/[A-Za-z]{2,}/.test(value) || allowed.has(value)) return;
    found.push({ text: value, line: sf.getLineAndCharacterOfPosition(node.getStart()).line + 1 });
  };
  walk(sf, (node) => {
    if (ts.isJsxText(node)) {
      report(node.text, node);
    } else if (
      ts.isJsxAttribute(node) &&
      USER_FACING_ATTRIBUTES.has(node.name.getText(sf)) &&
      node.initializer
    ) {
      const init = node.initializer;
      if (ts.isStringLiteral(init)) report(init.text, node);
      else if (ts.isJsxExpression(init) && init.expression && ts.isStringLiteral(init.expression)) {
        report(init.expression.text, node);
      }
    }
  });
  return found;
}

function listFiles(dir) {
  return readdirSync(dir).flatMap((entry) => {
    if (entry.startsWith(".") || entry === "node_modules") return [];
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) return listFiles(full);
    return /\.(ts|tsx|js|jsx|mjs)$/.test(entry) ? [full] : [];
  });
}

const isTestOrStory = (file) => /\.(test|stories)\.[jt]sx?$/.test(file) || /\.test\.[a-z]+\.[jt]sx?$/.test(file);

if (missingKeyReferences.size > 0) {
  errors.push({
    t

function listFiles(dir) {
  return readdirSync(dir).flatMap((entry) => {
    if (entry.startsWith(".") || entry === "node_modules") return [];
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) return listFiles(full);
    return /\.(ts|tsx|js|jsx|mjs)$/.test(entry) ? [full] : [];
  });
}

const isTestOrStory = (file) => /\.(test|stories)\.[jt]sx?$/.test(file) || /\.test\.[a-z]+\.[jt]sx?$/.test(file);

function main() {
  const root = join(fileURLToPath(new URL(".", import.meta.url)), "..");
  const messagesDir = join(root, "src/lib/i18n/messages");
  const catalogs = Object.fromEntries(
    readdirSync(messagesDir)
      .filter((f) => f.endsWith(".ts"))
      .map((f) => [f.replace(/\.ts$/, ""), parseCatalog(readFileSync(join(messagesDir, f), "utf8"))]),
  );
  const allowlist = JSON.parse(readFileSync(join(root, "scripts/i18n-literal-allowlist.json"), "utf8"));
  const allowed = new Set(allowlist.strings);

  const errors = checkCatalogs(catalogs);
  const literals = [];

  for (const file of listFiles(join(root, "src"))) {
    if (isTestOrStory(file)) continue;
    const rel = relative(root, file);
    const source = readFileSync(file, "utf8");
    const { keys, dynamic } = findKeyReferences(source, file);
    for (const { key, line } of keys) {
      if (!catalogs.en.has(key)) errors.push(`${rel}:${line}: t("${key}") is not in the English catalog`);
    }
    for (const { text, line } of dynamic) {
      errors.push(`${rel}:${line}: t(${text}) builds its key dynamically; use a typed Record<..., MessageKey> map`);
    }
    if (file.endsWith(".tsx") && /^src\/(app|components)\//.test(rel) && !allowlist.files.includes(rel)) {
      for (const { text, line } of findJsxLiterals(source, file, allowed)) {
        literals.push(`${rel}:${line}: "${text}"`);
      }
    }
  }

  if (literals.length > 0) {
    errors.push(
      `${literals.length} hard-coded JSX string(s); move them to src/lib/i18n/messages/ ` +
        `(or, for brand names and symbols, scripts/i18n-literal-allowlist.json):\n    ${literals.join("\n    ")}`,
    );
  }

  if (errors.length > 0) {
    console.error(`❌  i18n check failed:\n\n  ${errors.join("\n  ")}\n`);
    process.exit(1);
  }
  console.log(
    `✅  i18n OK: ${catalogs.en.size} keys in ${Object.keys(catalogs).join(", ")}; ` +
      "no unknown or dynamic keys and no hard-coded JSX text.",
  );
}

if (process.argv[1] && fileURLToPath(import.meta.url) === resolve(process.argv[1])) {
  main();
}

function listFiles(dir) {
  return readdirSync(dir).flatMap((entry) => {
    if (entry.startsWith(".") || entry === "node_modules") return [];
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) return listFiles(full);
    return /\.(ts|tsx|js|jsx|mjs)$/.test(entry) ? [full] : [];
  });
}

const isTestOrStory = (file) => /\.(test|stories)\.[jt]sx?$/.test(file) || /\.test\.[a-z]+\.[jt]sx?$/.test(file);

  }
  console.log(
    `✅  i18n OK: ${catalogs.en.size} keys in ${Object.keys(catalogs).join(", ")}; ` +
      "no unknown or dynamic keys and no hard-coded JSX text.",
  );
}

if (process.argv[1] && fileURLToPath(import.meta.url) === resolve(process.argv[1])) {
  main();
}

console.error(
  `Next steps:\n` +
  `  1. Fix catalog drift: add missing keys to en.ts or es.ts with proper translations\n` +
  `  2. Fix code references: update any t("...") or getMessage("...") calls to use valid keys\n` +
  `  3. Fix invalid ICU messages: ensure plural/select blocks have an "other" branch and valid categories\n` +
  `  4. Re-run: node scripts/check-i18n-parity.mjs`
);

process.exit(1);
