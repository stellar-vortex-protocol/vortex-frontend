import { defineConfig, devices } from "@playwright/test";

// Browser matrix: full matrix on main/nightly, chromium-only on PRs by default.
// Controlled via PLAYWRIGHT_BROWSERS (comma-separated) so CI can shard per browser.
const requestedBrowsers = (process.env.PLAYWRIGHT_BROWSERS ?? "chromium")
  .split(",")
  .map((name) => name.trim())
  .filter(Boolean);

const browserDevices: Record<string, (typeof devices)[string]> = {
  chromium: devices["Desktop Chrome"],
  firefox: devices["Desktop Firefox"],
  webkit: devices["Desktop Safari"],
};

const projects = requestedBrowsers
  .filter((name) => name in browserDevices)
  .map((name) => ({ name, use: { ...browserDevices[name] } }));

// Preview smoke runs target an already-deployed URL (BASE_URL) instead of a
// locally started dev server, so the webServer block is skipped in that mode.
const baseURL = process.env.BASE_URL ?? "http://localhost:3000";
const useExternalBaseURL = Boolean(process.env.BASE_URL);

// Visual-diff runs write screenshots to a dedicated directory so the diff
// bundle can be uploaded as a single artifact.
const visualDiffDir = process.env.VISUAL_DIFF_DIR;

// Mask dynamic regions (timestamps, avatars, wallet addresses) during visual
// comparisons to avoid false positives from non-deterministic content.
const visualMaskSelectors = [
  "[data-visual-mask]",
  "[data-testid='wallet-address']",
  "[data-testid='relative-time']",
  "[data-testid='avatar']",
];

export default defineConfig({
  testDir: "./e2e",
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  // Retries are limited to e2e runs in CI; flaky tests are reported in the job summary.
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI
    ? [["html", { open: "never" }], ["github"], ["json", { outputFile: "playwright-report/results.json" }]]
    : [["html", { open: "never" }]],
  use: {
    baseURL,
    trace: "on-first-retry",
  },
  expect: {
    toHaveScreenshot: {
      maxDiffPixelRatio: 0.02,
      mask: visualMaskSelectors.map((selector) => ({ selector })),
    },
  },
  snapshotDir: visualDiffDir ?? "./e2e/__screenshots__",
  projects,
  webServer: useExternalBaseURL
    ? undefined
    : {
        command: "npm run dev",
        url: "http://localhost:3000",
        reuseExistingServer: !process.env.CI,
        env: {
          NEXT_PUBLIC_API_URL: "http://localhost:4000",
        },
      },
});
