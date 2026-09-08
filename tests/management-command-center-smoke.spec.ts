import { test, expect } from "@playwright/test";

function managementCommandCenterUrl(): string {
  const base = process.env.APP_URL?.trim() || process.env.TEST_PREVIEW_URL?.trim() || "http://127.0.0.1:4173";
  return `${base.replace(/\/$/, "")}/admin/management-command-center`;
}

/**
 * Management macro runtime evidence (unauthenticated):
 * proves /admin/management-command-center is registered and enforces auth
 * before rendering governed management reporting surfaces.
 */
test.describe("Management command center auth gate", () => {
  test("redirects unauthenticated users away from management command center", async ({ page }) => {
    await page.goto(managementCommandCenterUrl());
    await page.waitForLoadState("networkidle");

    const url = page.url();
    const bodyText = await page.locator("body").innerText();

    const onLogin = /\/login/.test(url);
    const showsManagementCmd = /Management Command Center/i.test(bodyText);

    expect(onLogin, `expected redirect to /login, got ${url}`).toBeTruthy();
    expect(showsManagementCmd).toBeFalsy();
  });
});
