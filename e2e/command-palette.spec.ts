import { test, expect } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";

// Exercises the Cmd/Ctrl+K command palette end to end: open with the shortcut,
// filter, and navigate. No wallet or backend is needed - the palette is static
// navigation only.
test("command palette: open with the shortcut and jump to a route", async ({ page }) => {
  await page.goto("/");

  // Ctrl+K works cross-platform in Chromium; Meta+K is the macOS equivalent.
  await page.keyboard.press("Control+K");

  const palette = page.getByRole("dialog", { name: "Command palette" });
  await expect(palette).toBeVisible();

  await page.getByRole("combobox").fill("explore");
  await page.getByRole("option", { name: /Explore intents/ }).click();

  await expect(page).toHaveURL(/\/explore$/);
  await expect(palette).toBeHidden();
});

test("command palette: paste an intent id to open its detail page", async ({ page }) => {
  await page.goto("/");
  await page.keyboard.press("Control+K");

  await page.getByRole("combobox").fill("intent-1");
  await page.getByRole("option", { name: /Open intent/ }).click();

  await expect(page).toHaveURL(/\/explore\/intent-1$/);
});

// WCAG 2.2 AA gate: the command palette is a complex custom widget where
// regressions hide, so scan it with axe in both palettes and at both the
// mobile (400px) and desktop (1280px) breakpoints. Only serious/critical
// violations fail the build; the allowlist below documents justified
// exceptions (third-party markup we do not control).
const A11Y_ALLOWLIST: string[] = [];

const PALETTES = ["light", "dark"] as const;
const VIEWPORTS = [
  { name: "mobile", width: 400, height: 800 },
  { name: "desktop", width: 1280, height: 800 },
] as const;

for (const theme of PALETTES) {
  for (const viewport of VIEWPORTS) {
    test(`command palette a11y: ${theme} @ ${viewport.name}`, async ({ page }) => {
      await page.emulateMedia({ colorScheme: theme, reducedMotion: "reduce" });
      await page.setViewportSize({ width: viewport.width, height: viewport.height });
      await page.goto("/");

      await page.keyboard.press("Control+K");
      const palette = page.getByRole("dialog", { name: "Command palette" });
      await expect(palette).toBeVisible();

      const results = await new AxeBuilder({ page })
        .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"])
        .analyze();

      const blocking = results.violations.filter(
        (violation) =>
          (violation.impact === "serious" || violation.impact === "critical") &&
          !A11Y_ALLOWLIST.includes(violation.id),
      );

      expect(
        blocking,
        blocking
          .map((v) => `${v.id} (${v.impact}): ${v.help}`)
          .join("\n"),
      ).toEqual([]);
    });
  }
}
