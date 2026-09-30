import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";
import path from "node:path";

export default defineConfig({
  plugins: [react()],
  test: {
    environment: "jsdom",
    setupFiles: ["./vitest.setup.ts"],
    globals: true,
    // Playwright specs under e2e/ have their own runner; keep them out of the
    // unit test run so vitest doesn't try (and fail) to execute them.
    exclude: ["e2e/**", "node_modules/**", "dist/**", ".next/**"],
    coverage: {
      provider: "v8",
      reporter: ["text", "html", "lcov"],
      reportsDirectory: "./coverage",
      thresholds: {
        "src/lib/**": { lines: 90, functions: 90, branches: 85, statements: 90 },
        "src/hooks/**": { lines: 85, functions: 85, branches: 80, statements: 85 },
        "src/store/**": { lines: 90, functions: 90, branches: 85, statements: 90 },
        "src/components/**": { lines: 75, functions: 75, branches: 70, statements: 75 },
      },
    },
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
});
