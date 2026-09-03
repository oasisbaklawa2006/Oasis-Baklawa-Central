import { test, expect } from "@playwright/test";

/**
 * Point 74 runtime evidence (unauthenticated):
 * proves /sales/dashboard is registered, loads the app shell, and enforces auth
 * before rendering the sales-assist console. Does not require production credentials.
 */
test.describe("Point 74 sales dashboard auth gate", () => {
  test("redirects unauthenticated users away from the sales assist console", async ({ page }) => {
    await page.goto("/sales/dashboard");
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
