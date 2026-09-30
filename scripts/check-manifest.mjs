#!/usr/bin/env node

/**
 * Manifest consistency check (Issue #400).
 *
 * Fails when:
 * - package.json contains duplicate keys in any object (JSON.parse silently
 *   keeps the last one, so duplicates hide edits), or
 * - a workflow, husky hook or doc runs an npm script that package.json does
 *   not define (`npm run <name>`, `npm test`, `npm start`).
 */

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

/**
 * Returns `path.to.key` for every key that appears more than once in the
 * same JSON object. Assumes the input is otherwise valid JSON.
 */
export function findDuplicateKeys(jsonText) {
  const duplicates = [];
  // One entry per open object/array: { keys: Set | null, path: string[], lastKey }
  const stack = [];
  let i = 0;
  let expectKey = false;

  const readString = () => {
    let out = "";
    i++; // opening quote
    while (i < jsonText.length && jsonText[i] !== '"') {
      if (jsonText[i] === "\\") {
        out += jsonText[i] + jsonText[i + 1];
        i += 2;
      } else {
        out += jsonText[i++];
      }
    }
    i++; // closing quote
    return out;
  };

  while (i < jsonText.length) {
    const ch = jsonText[i];
    const top = stack[stack.length - 1];
    if (ch === "{" || ch === "[") {
      const parentPath = top ? [...top.path, ...(top.keys ? [top.lastKey] : [])] : [];
      stack.push({ keys: ch === "{" ? new Set() : null, path: parentPath, lastKey: "" });
      expectKey = ch === "{";
      i++;
    } else if (ch === "}" || ch === "]") {
      stack.pop();
      expectKey = false;
      i++;
    } else if (ch === ",") {
      expectKey = Boolean(top && top.keys);
      i++;
    } else if (ch === '"') {
      const value = readString();
      if (expectKey && top && top.keys) {
        if (top.keys.has(value)) {
          duplicates.push([...top.path, value].join("."));
        }
        top.keys.add(value);
        top.lastKey = value;
        expectKey = false;
      }
    } else {
      i++;
    }
  }
  return duplicates;
}

/** npm script names invoked in a shell/YAML/Markdown text. */
export function findScriptReferences(text) {
  const refs = new Set();
  for (const match of text.matchAll(/\bnpm run(?:-script)? ([A-Za-z0-9:_.-]+)/g)) {
    refs.add(match[1]);
  }
  for (const match of text.matchAll(/\bnpm (test|start)\b/g)) {
    refs.add(match[1]);
  }
  return refs;
}

/**
 * Checks a manifest against the files that reference its scripts.
 * `sources` is a list of { file, text }. Returns a list of error strings.
 */
export function checkManifest(packageJsonText, sources) {
  const errors = findDuplicateKeys(packageJsonText).map(
    (key) => `package.json: duplicate key "${key}"`,
  );
  const scripts = JSON.parse(packageJsonText).scripts ?? {};
  for (const { file, text } of sources) {
    for (const name of findScriptReferences(text)) {
      if (!(name in scripts)) {
        errors.push(`${file}: runs "npm run ${name}" but package.json has no "${name}" script`);
      }
    }
  }
  return errors;
}

function listFiles(dir, filter) {
  if (!fs.existsSync(dir)) return [];
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) return entry.name === "node_modules" ? [] : listFiles(full, filter);
    return filter(entry.name) ? [full] : [];
  });
}

function main() {
  const root = process.cwd();
  const files = [
    ...listFiles(path.join(root, ".github/workflows"), (n) => /\.ya?ml$/.test(n)),
    ...listFiles(path.join(root, ".husky"), (n) => !n.startsWith("_")),
    ...listFiles(path.join(root, "docs"), (n) => n.endsWith(".md")),
    ...listFiles(path.join(root, ".storybook"), (n) => n.endsWith(".md")),
    ...["README.md", "CONTRIBUTING.md"].map((n) => path.join(root, n)).filter((f) => fs.existsSync(f)),
  ];
  const sources = files.map((file) => ({
    file: path.relative(root, file),
    text: fs.readFileSync(file, "utf-8"),
  }));
  const errors = checkManifest(fs.readFileSync(path.join(root, "package.json"), "utf-8"), sources);

  if (errors.length > 0) {
    console.error("❌ package.json manifest check failed:");
    for (const error of errors) console.error(`   - ${error}`);
    process.exit(1);
  }
  console.log(`✅ package.json manifest OK (${sources.length} files checked)`);
}

if (process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1])) {
  main();
}
