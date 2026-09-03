import { test, expect } from "@playwright/test";
import { getPreviewUrl, login, requireEnv } from "./e2e-helpers";

/**
 * Point 74 authenticated readiness proof.
 * Skips unless TEST_SALES_EMAIL / TEST_SALES_PASSWORD are configured (no default credentials).
 * Safe to keep on branch during #448 merge hold — does not mutate production data.
 */
test.describe("Point 74 CRM-lite sales assistance (authenticated readiness)", () => {
  test.beforeEach(() => {
    test.skip(
      !process.env.TEST_SALES_EMAIL?.trim() || !process.env.TEST_SALES_PASSWORD?.trim(),
      "Set TEST_SALES_EMAIL and TEST_SALES_PASSWORD for authenticated Point 74 assist proof.",
    );
  });

  test("lands sales executive on assist console with Point 74 panel", async ({ page }) => {
    await login(page, requireEnv("TEST_SALES_EMAIL"), requireEnv("TEST_SALES_PASSWORD"));
    await page.goto(`${getPreviewUrl()}/sales/dashboard`, { waitUntil: "domcontentloaded", timeout: 60_000 });

    await expect(page.getByRole("heading", { name: /Sales Executive Console/i })).toBeVisible({ timeout: 30_000 });
    await expect(page.getByTestId("sales-crm-assist-panel")).toBeVisible({ timeout: 30_000 });
    await expect(page.getByText(/CRM-lite sales assistance/i)).toBeVisible();
    await expect(page.getByRole("button", { name: /Log Call/i })).toBeVisible();
    await expect(page.getByRole("button", { name: /Log Message/i })).toBeVisible();
  });

  test("Open assist deep-link focuses roster client on Assist tab", async ({ page }) => {
    await login(page, requireEnv("TEST_SALES_EMAIL"), requireEnv("TEST_SALES_PASSWORD"));
    await page.goto(`${getPreviewUrl()}/sales/dashboard`, { waitUntil: "domcontentloaded", timeout: 60_000 });

    const openAssist = page.getByRole("button", { name: "Open assist" }).first();
    await expect(openAssist).toBeVisible({ timeout: 30_000 });
    await openAssist.click();

    await expect(page.getByTestId("sales-crm-assist-panel")).toBeVisible();
    await expect(page.getByText(/^Assisting:/)).toBeVisible({ timeout: 10_000 });
  });
});
