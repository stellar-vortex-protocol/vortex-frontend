import { test, expect } from "@playwright/test";

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
