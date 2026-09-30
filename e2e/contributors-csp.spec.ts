import { test, expect } from "@playwright/test";

// /contributors must render under the production CSP with no violations:
// GitHub data comes from the same-origin /api/contributors route and avatars
// are served through next/image (/_next/image), so no CSP widening is needed.
test("contributors page renders without CSP violations", async ({ page }) => {
  const violations: string[] = [];
  page.on("console", (msg) => {
    if (/Content Security Policy|Refused to (load|connect)/i.test(msg.text())) {
      violations.push(msg.text());
    }
  });
  const thirdParty: string[] = [];
  page.on("request", (req) => {
    if (/api\.github\.com|avatars\.githubusercontent\.com/.test(req.url())) thirdParty.push(req.url());
  });

  const response = await page.goto("/contributors");
  expect(response?.headers()["content-security-policy"]).toContain("img-src 'self' data:");

  await expect(page.getByRole("heading", { name: "Contributors", level: 1 })).toBeVisible();
  await expect(page.getByRole("link", { name: /@/ }).first()).toBeVisible();

  expect(violations).toEqual([]);
  expect(thirdParty).toEqual([]);
});
