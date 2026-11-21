#!/usr/bin/env node
/**
 * doctor.mjs — one-command diagnostic for local contributor setup (Issue #521).
 *
 * Each check is a small async function returning { name, status, fix }:
 *   status: "pass" | "warn" | "fail"
 *   fix:    what to run or change when status is not "pass"
 *
 * "fail" is blocking and makes the process exit non-zero; "warn" is advisory.
 *
 * Usage:
 *   npm run doctor
 */

import { execFileSync } from "node:child_process";
import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { homedir, platform } from "node:os";
import { join, resolve } from "node:path";
import { createServer } from "node:net";
import { fileURLToPath } from "node:url";
import { ENV_SCHEMA, parseEnv } from "../src/lib/env-schema.mjs";
import { checkEnvironment } from "./env-manifest.mjs";

const ROOT = resolve(fileURLToPath(new URL(".", import.meta.url)), "..");
const DEV_PORT = 3000;

/** Parse KEY=VALUE lines from a dotenv file, dropping trailing `# comments`. */
export function parseDotenvValues(text) {
  const values = {};
  for (const line of text.split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eq = trimmed.indexOf("=");
    if (eq === -1) continue;
    values[trimmed.slice(0, eq).trim()] = trimmed.slice(eq + 1).replace(/\s+#.*$/, "").trim();
  }
  return values;
}

/** @returns {{ name: string, status: string, fix?: string }} */
export function checkNodeVersion({ root = ROOT, nodeVersion = process.versions.node } = {}) {
  const name = "Node version";
  const nvmrc = join(root, ".nvmrc");
  if (!existsSync(nvmrc)) return { name, status: "warn", fix: "Add a .nvmrc file or skip this check." };
  const required = readFileSync(nvmrc, "utf8").trim().replace(/^v/, "");
  const want = required.split(".");
  const have = nodeVersion.split(".");
  const matches = want.every((part, i) => part === have[i]);
  if (matches) return { name: `${name} (${nodeVersion})`, status: "pass" };
  return {
    name: `${name} (have ${nodeVersion}, need ${required})`,
    status: "fail",
    fix: `Switch Node with your version manager: "nvm install && nvm use", "fnm use", or "volta install node@${required}".`,
  };
}

/** Load config/environments/<name>.json, or null when it is absent/unreadable. */
function readManifest(root, environment) {
  const file = join(root, "config", "environments", `${environment}.json`);
  if (!existsSync(file)) return null;
  try {
    return JSON.parse(readFileSync(file, "utf8"));
  } catch {
    return null;
  }
}

/** @returns {{ name: string, status: string, fix?: string }} */
export function checkEnv({ root = ROOT, env = process.env } = {}) {
  const name = "Environment (.env.local)";
  const file = join(root, ".env.local");
  const fromFile = existsSync(file) ? parseDotenvValues(readFileSync(file, "utf8")) : {};
  const production = env.NODE_ENV === "production";
  // .env.local wins over the ambient shell, matching Next.js load order.
  const merged = { ...env, ...fromFile };
  const { errors } = parseEnv(merged, { production });
  // Same manifest rules as `npm run check:env`, so doctor names the keys the
  // app needs instead of passing while `npm run dev` fails on first boot.
  const manifest = readManifest(root, production ? "production" : "development");
  const manifestErrors = manifest ? checkEnvironment(manifest, merged) : [];
  if (!existsSync(file) && errors.length === 0 && manifestErrors.length === 0) {
    return { name, status: "warn", fix: "Run: cp .env.example .env.local (the devcontainer does this for you)." };
  }
  if (errors.length > 0 || manifestErrors.length > 0) {
    const problems = [...errors, ...manifestErrors];
    return { name: `${name}: ${problems.length} invalid`, status: "fail", fix: `Fix these in .env.local:\n    - ${problems.join("\n    - ")}` };
  }
  const known = new Set(ENV_SCHEMA.map((v) => v.name));
  const unknown = Object.keys(fromFile).filter((k) => !known.has(k));
  if (unknown.length > 0) {
    return { name: `${name}: unknown keys`, status: "warn", fix: `Not defined in src/lib/env-schema.mjs (typo?): ${unknown.join(", ")}` };
  }
  return { name, status: "pass" };
}

/** @returns {{ name: string, status: string, fix?: string }} */
export function checkLockfile({ root = ROOT } = {}) {
  const name = "Lockfile (package-lock.json)";
  const file = join(root, "package-lock.json");
  if (!existsSync(file) || statSync(file).size === 0) {
    return { name, status: "fail", fix: "The lockfile is missing or empty. Run: npm install (and commit the regenerated package-lock.json)." };
  }
  try {
    const lock = JSON.parse(readFileSync(file, "utf8"));
    if (!lock.lockfileVersion) throw new Error("no lockfileVersion");
  } catch {
    return { name, status: "fail", fix: "package-lock.json is not valid JSON. Regenerate it with: rm package-lock.json && npm install" };
  }
  return { name, status: "pass" };
}

/** @returns {{ name: string, status: string, fix?: string }} */
export function checkHusky({ root = ROOT, git = runGit } = {}) {
  const name = "Git hooks (Husky)";
  if (!existsSync(join(root, ".git"))) {
    return { name, status: "warn", fix: "Not a git checkout, so hooks are skipped. Clone with git to get commit checks." };
  }
  const hooksPath = git(["config", "--get", "core.hooksPath"], root);
  if (hooksPath !== ".husky/_" && hooksPath !== ".husky") {
    return { name, status: "warn", fix: "Run: npm run prepare (sets core.hooksPath to .husky/_)." };
  }
  return { name, status: "pass" };
}

/** @returns {{ name: string, status: string, fix?: string }} */
export function checkPlaywright({ env = process.env, home = homedir(), os = platform() } = {}) {
  const name = "Playwright browsers";
  const base =
    env.PLAYWRIGHT_BROWSERS_PATH ||
    (os === "darwin"
      ? join(home, "Library", "Caches", "ms-playwright")
      : os === "win32"
        ? join(env.LOCALAPPDATA || join(home, "AppData", "Local"), "ms-playwright")
        : join(home, ".cache", "ms-playwright"));
  const installed = existsSync(base) && readdirSync(base).some((d) => d.startsWith("chromium"));
  if (installed) return { name, status: "pass" };
  return { name, status: "warn", fix: "Only needed for e2e tests. Run: npx playwright install --with-deps chromium" };
}

/** @returns {Promise<{ name: string, status: string, fix?: string }>} */
export function checkPort({ port = DEV_PORT } = {}) {
  const name = `Port ${port} available`;
  return new Promise((resolvePromise) => {
    const server = createServer();
    server.once("error", () =>
      resolvePromise({ name, status: "warn", fix: `Port ${port} is in use. Stop the other process, or a dev server may already be running.` })
    );
    server.once("listening", () => server.close(() => resolvePromise({ name, status: "pass" })));
    server.listen(port, "127.0.0.1");
  });
}

/** @returns {Promise<{ name: string, status: string, fix?: string }>} */
export async function checkMockServer({ env = process.env, fetchImpl = fetch } = {}) {
  const name = "Backend / mock server reachable";
  const url = env.NEXT_PUBLIC_API_URL || "http://localhost:4000";
  try {
    await fetchImpl(url, { method: "HEAD", signal: AbortSignal.timeout(2000) });
    return { name, status: "pass" };
  } catch {
    return {
      name,
      status: "warn",
      fix: `Nothing answered at ${url}. Start a local vortex-backend, or point NEXT_PUBLIC_API_URL in .env.local at a backend you can reach.`,
    };
  }
}

function runGit(args, cwd) {
  try {
    return execFileSync("git", args, { cwd, encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] }).trim();
  } catch {
    return "";
  }
}

async function main() {
  const results = [
    checkNodeVersion(),
    checkEnv(),
    checkLockfile(),
    checkHusky(),
    checkPlaywright(),
    await checkPort(),
    await checkMockServer(),
  ];

  const icon = { pass: "✔", warn: "!", fail: "✖" };
  for (const r of results) {
    process.stdout.write(`${icon[r.status]} ${r.name}\n`);
    if (r.fix && r.status !== "pass") process.stdout.write(`    fix: ${r.fix}\n`);
  }

  const blocking = results.filter((r) => r.status === "fail").length;
  const warnings = results.filter((r) => r.status === "warn").length;
  const envResult = results.find((r) => r.name.startsWith("Environment (.env.local)"));
  const envBlocking = envResult?.status === "fail";
  process.stdout.write(
    `\n${blocking} blocking, ${warnings} warning(s)${envBlocking ? " — .env.local is missing or has invalid required keys" : ""}\n`,
  );
  process.exitCode = blocking > 0 ? 1 : 0;
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main();
}
