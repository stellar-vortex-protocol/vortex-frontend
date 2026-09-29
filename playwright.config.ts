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
    baseURL: "http://localhost:3000",
    trace: "on-first-retry",
  },
  projects,
  webServer: {
    command: "npm run dev",
    url: "http://localhost:3000",
    reuseExistingServer: !process.env.CI,
    env: {
      NEXT_PUBLIC_API_URL: "http://localhost:4000",
    },
  },
});
