import { defineConfig, devices } from "@playwright/test";

/**
 * Playwright configuration for Storybook visual regression testing
 * Run with: npm run test:visual
 *
 * Visual regression tests capture screenshots of all Storybook stories
 * and compare them against baseline images to detect unintended visual changes.
 */
export default defineConfig({
  testDir: "./storybook-static",
  testMatch: "**/*.stories.@(js|jsx|ts|tsx)",
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: [
    ["html", { open: "never", outputFolder: "playwright-report" }],
    ["blob"],
  ],
  use: {
    baseURL: "http://localhost:6006",
    trace: "on-first-retry",
    screenshot: "only-on-failure",
  },
  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
    },
  ],
  webServer: {
    command: "npx http-server storybook-static --port 6006 --gzip false",
    url: "http://localhost:6006",
    reuseExistingServer: !process.env.CI,
  },
});
