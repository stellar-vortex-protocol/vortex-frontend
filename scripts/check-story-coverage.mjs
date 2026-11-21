#!/usr/bin/env node

/**
 * Story coverage report.
 *
 * Lists every shared component under `src/components/**` that has no sibling
 * `<Name>.stories.tsx`, and exits non-zero while any are missing. Test files
 * and story files themselves are not components and are skipped.
 */

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const componentsDir = path.join(root, "src", "components");

function isComponentFile(name) {
  return name.endsWith(".tsx") && !name.endsWith(".test.tsx") && !name.endsWith(".stories.tsx");
}

export function findComponentsWithoutStories(dir) {
  const missing = [];
  let total = 0;
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      const nested = findComponentsWithoutStories(full);
      missing.push(...nested.missing);
      total += nested.total;
      continue;
    }
    if (!isComponentFile(entry.name)) continue;
    total += 1;
    const storyFile = path.join(dir, entry.name.replace(/\.tsx$/, ".stories.tsx"));
    if (!fs.existsSync(storyFile)) missing.push(path.relative(root, full));
  }
  return { total, missing };
}

const { total, missing } = findComponentsWithoutStories(componentsDir);
const covered = total - missing.length;
const percent = total === 0 ? 100 : Math.round((covered / total) * 100);

console.log(`Story coverage: ${covered}/${total} shared components (${percent}%)`);

if (missing.length > 0) {
  console.error(`Missing stories for ${missing.length} component(s):`);
  for (const file of missing) console.error(file);
  process.exitCode = 1;
}
