import { test, expect, type Page } from "@playwright/test";

const API_URL = "http://localhost:4000";
const PUBLIC_KEY = "GDEMOE2ESMOKETESTPUBLICKEY000000000000000000000";

// Freighter talks to the page over window.postMessage, not a `window.freighter`
// object with methods — this shims that bridge so the app's real
// @stellar/freighter-api calls resolve without the browser extension installed.
async function mockFreighter(page: Page) {
  await page.addInitScript((publicKey: string) => {
    (window as unknown as { freighter: boolean }).freighter = true;

    window.addEventListener("message", (event: MessageEvent) => {
      const data = event.data;
      if (event.source !== window || !data || data.source !== "FREIGHTER_EXTERNAL_MSG_REQUEST") {
        return;
      }

      const respond = (fields: Record<string, unknown>) => {
        window.postMessage(
          { source: "FREIGHTER_EXTERNAL_MSG_RESPONSE", messagedId: data.messageId, ...fields },
          "*"
        );
      };

      switch (data.type) {
        case "REQUEST_ACCESS":
        case "REQUEST_PUBLIC_KEY":
          respond({ publicKey, error: "" });
          break;
        case "REQUEST_NETWORK":
          respond({ network: "TESTNET", error: "" });
          break;
        case "REQUEST_ALLOWED_STATUS":
          respond({ isAllowed: true });
          break;
        case "SUBMIT_TRANSACTION":
          respond({ signedTransaction: "signed-xdr-e2e-mock", error: "" });
          break;
      }
    });
  }, PUBLIC_KEY);
}

async function mockBackend(page: Page) {
  await page.route(
    (url) => url.origin === API_URL && url.pathname === "/intents/feed",
    (route) => route.fulfill({ json: [] })
  );

  await page.route(
    (url) => url.origin === API_URL && url.pathname === "/quote",
    (route) =>
      route.fulfill({
        json: {
          dstAmount: "497.1234",
          solver: "Beta Liquidity Co",
          fillTimeSeconds: 32,
          priceImpactPct: 0.12,
          protocolFeePct: 0.05,
          rate: "1 USDC = 8.4600 XLM",
        },
      })
  );

  await page.route(
    (url) => url.origin === API_URL && url.pathname === "/intents",
    (route) => route.fulfill({ json: { intentId: "intent-1", unsignedXdr: "unsigned-xdr" } })
  );

  await page.route(
    (url) => url.origin === API_URL && url.pathname === "/intents/intent-1/submit",
    (route) => route.fulfill({ json: { intentId: "intent-1", status: "pending" } })
  );
}

test("swap happy path: connect wallet, get a quote, submit, and see success", async ({ page }) => {
  await mockFreighter(page);
  await mockBackend(page);

  await page.goto("/");

  await page.getByRole("button", { name: "Connect Freighter" }).click();
  await expect(page.getByRole("button", { name: /^Disconnect wallet/ })).toBeVisible();

  await page.getByPlaceholder("0").fill("500");
  await expect(page.getByText("Beta Liquidity Co")).toBeVisible();

  await page.getByRole("button", { name: "Swap 500 USDC → USDC" }).click();

  await expect(
    page.getByRole("status").filter({ hasText: "Swap submitted successfully." })
  ).toBeVisible();
});
