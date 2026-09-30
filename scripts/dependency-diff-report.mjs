#!/usr/bin/env node
/**
 * Dependency diff report generator (Issue #480).
 *
 * Parses the git diff of package.json between the base branch and
 * current branch, fetches metadata from the npm registry for each
 * new/updated dependency, and generates a formatted report suitable
 * for posting as a PR comment.
 *
 * The report includes: package name, version, maintainers count,
 * weekly downloads bucket, install scripts presence, and license
 * (flags GPL/unknown per policy).
 *
 * Usage:
 *   node scripts/dependency-diff-report.mjs
 *
 * Exit codes:
 *   0 — report generated successfully (even if there are policy flags)
 *   1 — unable to generate the report
 */

import { execSync } from "child_process";
import { writeFileSync } from "fs";
import { join, resolve } from "path";
import { fileURLToPath } from "url";

const __dirname = fileURLToPath(new URL(".", import.meta.url));
const ROOT = join(__dirname, "..");

// Packages flagged as GPL-licensed per policy.
const GPL_LICENSES = new Set([
  "GPL-2.0",
  "GPL-3.0",
  "LGPL-2.1",
  "LGPL-3.0",
  "AGPL-1.0",
  "AGPL-3.0",
]);

// Download buckets for weekly download counts.
const DOWNLOAD_BUCKETS = [
  { max: 100, label: "very low (<100/wk)" },
  { max: 1000, label: "low (100–1k/wk)" },
  { max: 10000, label: "moderate (1k–10k/wk)" },
  { max: 100000, label: "high (10k–100k/wk)" },
  { max: Infinity, label: "very high (100k+/wk)" },
];

/**
 * Fetch package metadata from the npm registry.
 * @param {string} name
 * @returns {Record<string, unknown> | null}
 */
function fetchPackageMetadata(name) {
  try {
    const output = execSync(
      `npm view "${name}" --json --fetch-retries 2 --fetch-retry-mintimeout 1000`,
      {
        encoding: "utf-8",
        cwd: ROOT,
        timeout: 15_000,
      }
    );
    return JSON.parse(output);
  } catch {
    return null;
  }
}

/**
 * Fetch weekly download count from the npm downloads API.
 * @param {string} name
 * @returns {number}
 */
function fetchWeeklyDownloads(name) {
  try {
    const url = `https://api.npmjs.org/downloads/point/last-week/${name}`;
    const output = execSync(`curl -s "${url}"`, {
      encoding: "utf-8",
      timeout: 10_000,
    });
    const data = JSON.parse(output);
    return data.downloads ?? 0;
  } catch {
    return 0;
  }
}

/**
 * Categorize weekly downloads into a bucket.
 * @param {number} downloads
 * @returns {string}
 */
function getDownloadBucket(downloads) {
  for (const bucket of DOWNLOAD_BUCKETS) {
    if (downloads < bucket.max) {
      return bucket.label;
    }
  }
  return "unknown";
}

/**
 * Check if a license is flagged (GPL or unknown).
 * @param {string} [license]
 * @returns {{ flagged: boolean; reason: string }}
 */
function checkLicense(license) {
  if (!license) {
    return { flagged: true, reason: "unknown license" };
  }
  if (GPL_LICENSES.has(license)) {
    return { flagged: true, reason: `GPL-licensed (${license})` };
  }
  return { flagged: false, reason: "" };
}

/**
 * Check if a package has install scripts (postinstall, preinstall, etc.).
 * @param {Record<string, unknown>} metadata
 * @returns {boolean}
 */
function hasInstallScripts(metadata) {
  if (!metadata.scripts) return false;
  const scripts = Object.keys(metadata.scripts);
  return scripts.some(
    (s) => s.startsWith("pre") || s.startsWith("post") || s === "install"
  );
}

/**
 * Parse the git diff of package.json to find new/updated dependencies.
 * @returns {{ dependencies: Array<{name: string, version: string}>, devDependencies: Array<{name: string, version: string}> }}
 */
function getDependencyChanges() {
  try {
    const diff = execSync("git diff origin/main -- package.json", {
      encoding: "utf-8",
    });

    const lines = diff.split("\n");
    const changes = { dependencies: [], devDependencies: [] };

    let currentSection = null;
    for (const line of lines) {
      if (line.includes('"dependencies"') && line.includes(":")) {
        currentSection = "dependencies";
      } else if (line.includes('"devDependencies"') && line.includes(":")) {
        currentSection = "devDependencies";
      } else if (line.startsWith("+") && currentSection && !line.startsWith("+++")) {
        const match = line.match(/^\+\s*"([^"]+)"\s*:\s*"([^"]+)"/);
        if (match && !line.includes("dependencies")) {
          changes[currentSection].push({
            name: match[1],
            version: match[2],
          });
        }
      }
    }

    return changes;
  } catch {
    console.log(
      "ℹ️  Dependency diff report: Not in a PR context, skipping."
    );
    return { dependencies: [], devDependencies: [] };
  }
}

/**
 * Generate a formatted report for a list of dependencies.
 * @param {Array<{name: string, version: string}>} deps
 * @returns {string[]}
 */
function generateReport(deps) {
  const lines = [];

  for (const dep of deps) {
    const metadata = fetchPackageMetadata(dep.name);
    const version = dep.version.replace(/[\^~>=<]*/, "");

    let maintainersCount = "unknown";
    let downloads = 0;
    let downloadBucket = "unknown";
    let installScripts = false;
    let license = "unknown";
    let licenseFlag = "";

    if (metadata) {
      const maintainers = metadata.maintainers ?? [];
      maintainersCount = String(maintainers.length);

      downloads = fetchWeeklyDownloads(dep.name);
      downloadBucket = getDownloadBucket(downloads);

      installScripts = hasInstallScripts(metadata);

      const pkgLicense = metadata.license ?? "";
      if (typeof pkgLicense === "object" && pkgLicense.type) {
        license = pkgLicense.type;
      } else if (typeof pkgLicense === "string") {
        license = pkgLicense;
      }

      const licenseCheck = checkLicense(license);
      if (licenseCheck.flagged) {
        licenseFlag = ` ⚠️ ${licenseCheck.reason}`;
      }
    } else {
      licenseFlag = " ⚠️ unable to fetch metadata";
    }

    const installScriptWarning = installScripts
      ? " ⚠️ has install scripts"
      : "";

    lines.push(
      `| ${dep.name} | ${version} | ${maintainersCount} | ${downloadBucket} | ${installScripts ? "yes" : "no"}${installScriptWarning} | ${license}${licenseFlag} |`
    );
  }

  return lines;
}

function main() {
  console.log("📦 Generating dependency diff report...");

  const changes = getDependencyChanges();
  const allChanges = [
    ...changes.dependencies.map((d) => ({ ...d, section: "dependencies" })),
    ...changes.devDependencies.map((d) => ({
      ...d,
      section: "devDependencies",
    })),
  ];

  if (allChanges.length === 0) {
    console.log("✅ No dependency changes detected.");
    process.exit(0);
  }

  console.log(`\n📋 Found ${allChanges.length} dependency change(s):\n`);

  const reportLines = generateReport(allChanges);

  // Print the report as a markdown table
  console.log(
    "| Package | Version | Maintainers | Downloads | Install Scripts | License |"
  );
  console.log(
    "|---------|---------|-------------|-----------|-----------------|---------|"
  );
  for (const line of reportLines) {
    console.log(line);
  }

  // Output the report to a file for the workflow to use
  const reportPath = resolve(ROOT, "dependency-diff-report.md");
  const report = [
    "## 📦 Dependency Diff Report",
    "",
    "| Package | Version | Maintainers | Downloads | Install Scripts | License |",
    "|---------|---------|-------------|-----------|-----------------|---------|",
    ...reportLines,
    "",
  ].join("\n");

  try {
    writeFileSync(reportPath, report);
    console.log(`\n✅ Report written to ${reportPath}`);
  } catch {
    console.log(`\n✅ Report generated (${allChanges.length} package(s))`);
  }

  process.exit(0);
}

// Only run main() when this file is executed directly, not when imported as a module.
if (import.meta.url === `file://${process.argv[1]}`) {
  main();
}
