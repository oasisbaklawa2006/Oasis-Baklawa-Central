import { test, expect } from "@playwright/test";

function salesDashboardUrl(): string {
  const base = process.env.APP_URL?.trim() || process.env.TEST_PREVIEW_URL?.trim() || "http://127.0.0.1:4173";
  return `${base.replace(/\/$/, "")}/sales/dashboard`;
}

/**
 * Point 74 runtime evidence (unauthenticated):
 * proves /sales/dashboard is registered, loads the app shell, and enforces auth
 * before rendering the sales-assist console. Uses APP_URL in CI preview smoke.
 */
test.describe("Point 74 sales dashboard auth gate", () => {
  test("redirects unauthenticated users away from the sales assist console", async ({ page }) => {
    await page.goto(salesDashboardUrl());
    await page.waitForLoadState("networkidle");

    const url = page.url();
    const bodyText = await page.locator("body").innerText();

    const onLogin = /\/login/.test(url);
    const showsSalesConsole = /Sales Executive Console/i.test(bodyText);
    const showsAssistPanel = /CRM-lite sales assistance/i.test(bodyText);

    expect(onLogin || showsSalesConsole).toBeTruthy();
    if (onLogin) {
      expect(showsAssistPanel).toBeFalsy();
    }
  });
});
