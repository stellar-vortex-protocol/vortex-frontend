#!/usr/bin/env node

/**
 * Dependency provenance check for supply-chain security (Issue #311).
 *
 * This script checks for new or updated dependencies in package.json and ensures
 * they are justified in the PR description. This is a lightweight, human-review-forcing
 * check to detect potential typosquats, unexpected updates, or supply-chain compromises.
 */

import { execSync } from "child_process";
import fs from "fs";

const DEPENDENCY_MARKER = "[x] I have reviewed and documented any dependency changes";

function getDependencyChanges() {
  try {
    // Get the diff of package.json between the base branch and current branch
    const diff = execSync("git diff origin/main -- package.json", {
      encoding: "utf-8",
    });

    // Parse the diff to find added or modified lines in dependencies/devDependencies
    const lines = diff.split("\n");
    const changes = { dependencies: [], devDependencies: [] };

    let currentSection = null;
    for (const line of lines) {
      if (line.includes('"dependencies"')) {
        currentSection = "dependencies";
      } else if (line.includes('"devDependencies"')) {
        currentSection = "devDependencies";
      } else if (line.startsWith("+") && currentSection && !line.startsWith("+++")) {
        // This is a new line in dependencies
        const match = line.match(/"([^"]+)"/);
        if (match && !line.includes("dependencies")) {
          changes[currentSection].push(match[1]);
        }
      } else if (line.startsWith("-") && currentSection && !line.startsWith("---")) {
        // Track removed dependencies too
        const match = line.match(/"([^"]+)"/);
        if (match && !line.includes("dependencies")) {
          // Package was removed, which is fine
        }
      }
    }

    return changes;
  } catch (err) {
    // If git diff fails (not in a PR context), skip the check
    console.log("ℹ️  Dependency check: Not in a PR context, skipping.");
    return { dependencies: [], devDependencies: [] };
  }
}

function checkPRDescription() {
  // Get PR body from environment or git
  let prBody = process.env.PR_BODY || "";

  if (!prBody) {
    try {
      // Try to get PR info via git log
      const lastCommitMessage = execSync("git log -1 --pretty=%B", {
        encoding: "utf-8",
      });
      prBody = lastCommitMessage;
    } catch {
      // If we can't get PR info, we're probably not in a PR
      return false;
    }
  }

  return prBody.toLowerCase().includes(DEPENDENCY_MARKER) || prBody.toLowerCase().includes("dependency");
}

function isAutomatedPR() {
  // Check if this is a Dependabot or automated PR
  const actor = process.env.GITHUB_ACTOR || "";
  return actor.includes("dependabot") || actor.includes("renovate");
}

function main() {
  console.log("🔍 Checking for dependency changes...");

  const changes = getDependencyChanges();
  const hasChanges = changes.dependencies.length > 0 || changes.devDependencies.length > 0;

  if (!hasChanges) {
    console.log("✅ No dependency changes detected.");
    process.exit(0);
  }

  console.log("\n📦 Dependency changes found:");
  if (changes.dependencies.length > 0) {
    console.log(`   Dependencies: ${changes.dependencies.join(", ")}`);
  }
  if (changes.devDependencies.length > 0) {
    console.log(`   DevDependencies: ${changes.devDependencies.join(", ")}`);
  }

  // If this is an automated PR (Dependabot), only warn
  if (isAutomatedPR()) {
    console.log("\n⚠️  Automated PR detected (Dependabot/Renovate). Dependency updates are advisory-only.");
    process.exit(0);
  }

  // For human-authored PRs, require justification for security-sensitive packages
  const securitySensitivePackages = ["@stellar/freighter-api", "@stellar/stellar-sdk"];
  const addedSecurityPackages = changes.dependencies.filter((p) =>
    securitySensitivePackages.includes(p)
  );

  if (addedSecurityPackages.length > 0) {
    console.log(
      `\n⚠️  Security-sensitive packages detected: ${addedSecurityPackages.join(", ")}`
    );
    console.log(
      "   These packages require explicit justification in the PR description."
    );

    const hasPRJustification = checkPRDescription();
    if (!hasPRJustification) {
      console.error(
        "\n❌ FAILED: Security-sensitive packages require PR description justification."
      );
      console.error(`   Add this checkbox to your PR description to acknowledge the change:`);
      console.error(`   ${DEPENDENCY_MARKER}`);
      process.exit(1);
    }

    console.log("✅ Security-sensitive package changes are documented.");
  } else {
    console.log(
      "\n✅ No security-sensitive package changes detected (advisory check complete)."
    );
  }

  process.exit(0);
}

main();
