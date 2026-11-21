import { readdirSync, statSync } from "node:fs";
import { join } from "node:path";

// Sum of all client JS chunks Next.js emits for the production build.
// Adjust this once a green baseline build is available; see PR description
// for how this number was derived.
const MAX_BUNDLE_SIZE_BYTES = 1_500_000;

const chunksDir = join(process.cwd(), ".next", "static", "chunks");

function collectJsChunks(dir, baseDir = dir, chunks = []) {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const fullPath = join(dir, entry.name);
    if (entry.isDirectory()) {
      collectJsChunks(fullPath, baseDir, chunks);
    } else if (entry.isFile() && entry.name.endsWith(".js")) {
      chunks.push({
        name: fullPath.slice(baseDir.length + 1),
        size: statSync(fullPath).size,
      });
    }
  }
  return chunks;
}

const chunks = collectJsChunks(chunksDir);
const totalBytes = chunks.reduce((sum, chunk) => sum + chunk.size, 0);
const totalKb = (totalBytes / 1024).toFixed(1);
const maxKb = (MAX_BUNDLE_SIZE_BYTES / 1024).toFixed(1);

console.log(`Client JS bundle size: ${totalKb} KB (limit: ${maxKb} KB)`);

// Accumulate every chunk that individually exceeds the budget so the report
// names the offenders instead of only the aggregate total.
const violations = chunks
  .filter((chunk) => chunk.size > MAX_BUNDLE_SIZE_BYTES)
  .sort((a, b) => b.size - a.size);

if (totalBytes > MAX_BUNDLE_SIZE_BYTES || violations.length > 0) {
  if (violations.length > 0) {
    const rows = violations.map((chunk) => [
      chunk.name,
      `${(chunk.size / 1024).toFixed(1)} KB`,
      `${maxKb} KB`,
      `+${((chunk.size - MAX_BUNDLE_SIZE_BYTES) / 1024).toFixed(1)} KB`,
    ]);
    const header = ["Chunk", "Actual size", "Budget", "Over by"];
    const widths = header.map((label, index) =>
      Math.max(label.length, ...rows.map((row) => row[index].length))
    );
    const formatRow = (row) =>
      row.map((cell, index) => cell.padEnd(widths[index])).join("  ");

    console.error("");
    console.error("Bundle budget violations:");
    console.error(formatRow(header));
    console.error(widths.map((width) => "-".repeat(width)).join("  "));
    for (const row of rows) {
      console.error(formatRow(row));
    }
    console.error("");
  }

  console.error(
    `Bundle size exceeds the ${maxKb} KB threshold. Reduce bundle size or update MAX_BUNDLE_SIZE_BYTES in scripts/check-bundle-size.mjs if the growth is expected.`
  );
  process.exit(1);
}
