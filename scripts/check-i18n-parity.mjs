#!/usr/bin/env node
/**
 * check-i18n-parity.mjs
 *
 * Enforces i18n consistency for the single catalog in src/lib/i18n/messages/:
 * 1. Every locale has exactly the English key set.
 * 2. Every translation uses the same {placeholder} tokens as English.
 * 3. Every literal t("key") in src/ exists in the English catalog, and no
 *    t() call builds its key from a template string (those can't be checked
 *    statically; use a typed `Record<..., MessageKey>` map instead).
 * 4. JSX in src/app/** and src/components/** has no hard-coded user-facing
 *    text (JSX text, or aria-label / title / placeholder / alt strings),
 *    except entries in scripts/i18n-literal-allowlist.json.
 *
 * Usage:
 *   node scripts/check-i18n-parity.mjs
 */

import { readFileSync, readdirSync, statSync } from "node:fs";
import { join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import ts from "typescript";

const USER_FACING_ATTRIBUTES = new Set(["aria-label", "title", "placeholder", "alt"]);

function parse(source, fileName = "file.tsx") {
  return ts.createSourceFile(fileName, source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
}

function walk(node, visit) {
  visit(node);
  ts.forEachChild(node, (child) => walk(child, visit));
}

/** Reads `export const xx = { "key": "value", ... }` into a Map. */
export function parseCatalog(source) {
  const catalog = new Map();
  walk(parse(source), (node) => {
    if (!ts.isPropertyAssignment(node) || !ts.isObjectLiteralExpression(node.parent)) return;
    const name = node.name;
    const key = ts.isStringLiteral(name) || ts.isIdentifier(name) ? name.text : null;
    let init = node.initializer;
    while (ts.isParenthesizedExpression(init)) init = init.expression;
    if (key !== null && (ts.isStringLiteral(init) || ts.isNoSubstitutionTemplateLiteral(init))) {
      catalog.set(key, init.text);
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
