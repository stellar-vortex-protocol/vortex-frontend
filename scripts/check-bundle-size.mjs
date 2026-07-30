import { readdirSync, statSync } from "node:fs";
import { join } from "node:path";

// Sum of all client JS chunks Next.js emits for the production build.
// Adjust this once a green baseline build is available; see PR description
// for how this number was derived.
const MAX_BUNDLE_SIZE_BYTES = 1_500_000;

const chunksDir = join(process.cwd(), ".next", "static", "chunks");

function totalJsSize(dir) {
  let total = 0;
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const fullPath = join(dir, entry.name);
    if (entry.isDirectory()) {
      total += totalJsSize(fullPath);
    } else if (entry.isFile() && entry.name.endsWith(".js")) {
      total += statSync(fullPath).size;
    }
  }
  return total;
}

const totalBytes = totalJsSize(chunksDir);
const totalKb = (totalBytes / 1024).toFixed(1);
const maxKb = (MAX_BUNDLE_SIZE_BYTES / 1024).toFixed(1);

console.log(`Client JS bundle size: ${totalKb} KB (limit: ${maxKb} KB)`);

if (totalBytes > MAX_BUNDLE_SIZE_BYTES) {
  console.error(
    `Bundle size exceeds the ${maxKb} KB threshold. Reduce bundle size or update MAX_BUNDLE_SIZE_BYTES in scripts/check-bundle-size.mjs if the growth is expected.`
  );
  process.exit(1);
}
