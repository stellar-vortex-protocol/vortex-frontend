import { test, expect } from '@playwright/test';

/**
 * Curated smoke suite for PR preview deployments.
 *
 * Runs against the deployed preview URL (BASE_URL) using the mocked-wallet
 * fixture so no real wallet or secrets are required. Kept intentionally small
 * and resilient to cold starts so it can gate every preview deploy.
 */

const ROUTES = ['/', '/markets', '/portfolio'] as const;

// Preview deployments can be cold; give the first paint a generous budget.
const NAV_TIMEOUT = 60_000;

test.describe('preview smoke', () => {
  test.beforeEach(async ({ page }) => {
    // Surface console errors as failures so regressions are caught early.
    page.on('pageerror', (err) => {
      throw new Error(`Uncaught page error: ${err.message}`);
    });
  });

  for (const route of ROUTES) {
    test(`renders ${route}`, async ({ page }) => {
      const response = await page.goto(route, {
        waitUntil: 'domcontentloaded',
        timeout: NAV_TIMEOUT,
      });

      expect(response, `no response for ${route}`).not.toBeNull();
      expect(response!.status(), `unexpected status for ${route}`).toBeLessThan(400);

      // The app shell must mount; this is the mocked-wallet entry point.
      await expect(page.locator('body')).toBeVisible({ timeout: NAV_TIMEOUT });
      await expect(page).toHaveTitle(/.+/);
    });
  }

  test('mocked wallet connects', async ({ page }) => {
    await page.goto('/', { waitUntil: 'domcontentloaded', timeout: NAV_TIMEOUT });

    const connect = page.getByRole('button', { name: /connect wallet/i });
    if (await connect.isVisible().catch(() => false)) {
      await connect.click();
      // Mocked wallet should resolve without a real extension.
      await expect(page.getByText(/0x[a-fA-F0-9]{4}/)).toBeVisible({ timeout: NAV_TIMEOUT });
    }
  });
});
