import { readdir, readFile } from 'node:fs/promises';
import { join, relative } from 'node:path';

const root = process.cwd();
const componentsDir = join(root, 'src', 'components');
const storySuffix = '.stories.tsx';
const docsPath = 'docs/visual-testing.md';

async function walk(dir) {
  const entries = await readdir(dir, { withFileTypes: true });
  const files = [];
  for (const entry of entries) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) {
      files.push(...(await walk(full)));
    } else {
      files.push(full);
    }
  }
  return files;
}

function isComponentFile(file) {
  return file.endsWith('.tsx') && !file.endsWith('.stories.tsx') && !file.endsWith('.test.tsx');
}

function expectedStoryPath(componentFile) {
  return componentFile.replace(/\.tsx$/, storySuffix);
}

const files = await walk(componentsDir);
const storyFiles = new Set(files.filter((file) => file.endsWith(storySuffix)));
const componentFiles = files.filter(isComponentFile);

const missing = [];
for (const componentFile of componentFiles) {
  const storyFile = expectedStoryPath(componentFile);
  if (!storyFiles.has(storyFile)) {
    missing.push({ componentFile, storyFile });
  }
}

if (missing.length > 0) {
  console.error(`Missing stories for ${missing.length} component(s):\n`);
  for (const { componentFile, storyFile } of missing) {
    console.error(`  component: ${relative(root, componentFile)}`);
    console.error(`  expected:  ${relative(root, storyFile)}\n`);
  }
  console.error(`See ${docsPath} for the story convention.`);
  process.exit(1);
}

console.log(`All ${componentFiles.length} component(s) have stories.`);
