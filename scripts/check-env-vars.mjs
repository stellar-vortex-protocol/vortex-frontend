#!/usr/bin/env node
/**
 * check-env-vars.mjs
 *
 * Scans all TypeScript/JavaScript source files under src/ for
 * process.env.<VAR_NAME> references and verifies that every variable found
 * is documented in .env.example.
 *
 * Usage:
 *   node scripts/check-env-vars.mjs
 *
 * Exit codes:
 *   0 — all env vars are documented
 *   1 — one or more env vars are missing from .env.example
 */

import { readFileSync, readdirSync, statSync } from "fs";
import { join, relative } from "path";
import { fileURLToPath } from "url";

const __dirname = fileURLToPath(new URL(".", import.meta.url));
const ROOT = join(__dirname, "..");

// ── 1. Parse .env.example to collect documented variable names ──────────────

const envExamplePath = join(ROOT, ".env.example");
let envExampleContent;
try {
  envExampleContent = readFileSync(envExamplePath, "utf8");
} catch {
  console.error(`ERROR: Could not read ${envExamplePath}`);
  process.exit(1);
}

/** @type {Set<string>} */
const documentedVars = new Set();
for (const line of envExampleContent.split("\n")) {
  const trimmed = line.trim();
  // Skip blank lines and comments
  if (!trimmed || trimmed.startsWith("#")) continue;
  const eqIndex = trimmed.indexOf("=");
  if (eqIndex !== -1) {
    documentedVars.add(trimmed.slice(0, eqIndex).trim());
  }
}

// ── 2. Walk src/ and collect all process.env.<VAR> references ───────────────

const SOURCE_EXTENSIONS = new Set([".ts", ".tsx", ".js", ".jsx", ".mjs"]);
// Matches process.env.VAR_NAME or process.env["VAR_NAME"] / process.env['VAR_NAME']
const ENV_REF_RE = /process\.env(?:\.([A-Z0-9_]+)|\[['"]([A-Z0-9_]+)['"]\])/g;

/** @type {Map<string, string[]>} varName → list of "file:line" locations */
const usedVars = new Map();

/**
 * Recursively walk a directory, calling `cb` for every matching file.
 * @param {string} dir
 * @param {(filePath: string) => void} cb
 */
function walk(dir, cb) {
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
}

walk(join(ROOT, "src"), (filePath) => {
  const content = readFileSync(filePath, "utf8");
  const lines = content.split("\n");
  for (let lineNo = 0; lineNo < lines.length; lineNo++) {
    let match;
    ENV_REF_RE.lastIndex = 0;
    while ((match = ENV_REF_RE.exec(lines[lineNo])) !== null) {
      const varName = match[1] ?? match[2];
      if (!varName) continue;
      const location = `${relative(ROOT, filePath)}:${lineNo + 1}`;
      if (!usedVars.has(varName)) usedVars.set(varName, []);
      usedVars.get(varName).push(location);
    }
  }
});

// ── 3. Check for insecure schemes in production ──────────────────────────────

const IS_PRODUCTION_BUILD = process.env.NODE_ENV === "production";
const API_URL = process.env.NEXT_PUBLIC_API_URL || "";
const WS_URL = process.env.NEXT_PUBLIC_WS_URL || "";

const insecureSchemes = [];

if (IS_PRODUCTION_BUILD) {
  const isLocalhost = (url) => {
    try {
      const parsed = new URL(url);
      return (
        parsed.hostname === "localhost" ||
        parsed.hostname === "127.0.0.1" ||
        parsed.hostname === "[::1]"
      );
    } catch {
      return false;
    }
  };

  if (API_URL && !isLocalhost(API_URL)) {
    if (API_URL.startsWith("http://")) {
      insecureSchemes.push({
        var: "NEXT_PUBLIC_API_URL",
        url: API_URL,
        issue: 'uses "http://" instead of "https://"',
      });
    }
  }

  if (WS_URL && !isLocalhost(WS_URL)) {
    if (WS_URL.startsWith("ws://")) {
      insecureSchemes.push({
        var: "NEXT_PUBLIC_WS_URL",
        url: WS_URL,
        issue: 'uses "ws://" instead of "wss://"',
      });
    }
  }
}

// ── 4. Report ────────────────────────────────────────────────────────────────

/** @type {Array<{varName: string, locations: string[]}>} */
const undocumented = [];
for (const [varName, locations] of usedVars) {
  if (!documentedVars.has(varName)) {
    undocumented.push({ varName, locations });
  }
}

let hasErrors = false;

if (undocumented.length > 0) {
  hasErrors = true;
  console.error(
    `❌  ${undocumented.length} env var(s) used in source are NOT documented in .env.example:\n`
  );
  for (const { varName, locations } of undocumented) {
    console.error(`  ${varName}`);
    for (const loc of locations) {
      console.error(`    → ${loc}`);
    }
  }
  console.error(
    "\nAdd the missing variable(s) to .env.example (with an inline comment explaining their purpose) and re-run this check."
  );
}

if (insecureSchemes.length > 0) {
  hasErrors = true;
  console.error(
    `❌  ${insecureSchemes.length} security issue(s) detected in production build:\n`
  );
  for (const { var: varName, url, issue } of insecureSchemes) {
    console.error(`  ${varName}: ${issue}`);
    console.error(`    Current value: ${url}`);
  }
  console.error(
    "\nIn production, all remote URLs must use secure schemes (https:// for API, wss:// for WebSocket)."
  );
  console.error("Localhost (127.0.0.1, localhost, [::1]) is exempt for testing.");
}

if (hasErrors) {
  process.exit(1);
}

console.log(
  `✅  All ${usedVars.size} env var(s) used in source are documented in .env.example.`
);
if (IS_PRODUCTION_BUILD) {
  console.log("✅  No insecure schemes detected in production build.");
}
process.exit(0);
