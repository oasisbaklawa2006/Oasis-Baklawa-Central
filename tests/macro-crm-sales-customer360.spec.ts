import { test, expect } from "@playwright/test";
import { getPreviewUrl, login, requireEnv } from "./e2e-helpers";

/**
 * Macro CRM journey — salesperson manages assigned customer via Customer 360.
 * Skips unless TEST_SALES_EMAIL / TEST_SALES_PASSWORD are configured.
 */
test.describe("Macro CRM sales Customer 360 journey", () => {
  test.beforeEach(() => {
    test.skip(
      !process.env.TEST_SALES_EMAIL?.trim() || !process.env.TEST_SALES_PASSWORD?.trim(),
      "Set TEST_SALES_EMAIL and TEST_SALES_PASSWORD for authenticated macro CRM journey proof.",
    );
  });

  test("sales executive opens Customer 360 from roster and sees governed slices", async ({ page }) => {
    await login(page, requireEnv("TEST_SALES_EMAIL"), requireEnv("TEST_SALES_PASSWORD"));
    await page.goto(`${getPreviewUrl()}/sales/dashboard`, { waitUntil: "domcontentloaded", timeout: 60_000 });

    await expect(page.getByRole("heading", { name: /Sales Executive Console/i })).toBeVisible({ timeout: 30_000 });

    const view360 = page.getByRole("link", { name: /View 360/i }).first();
    await expect(view360).toBeVisible({ timeout: 30_000 });
    await view360.click();

    await expect(page.getByRole("heading", { name: /Customer 360/i })).toBeVisible({ timeout: 30_000 });
    await expect(page.getByText(/Communication history/i)).toBeVisible();
    await expect(page.getByText(/Branches & contacts/i)).toBeVisible();
    await expect(page.getByText(/Finance exposure/i)).toBeVisible();
    await expect(page.getByText(/Account health & next best action/i)).toBeVisible();
    await expect(page.getByText(/WhatsApp order linkage/i)).toBeVisible();
    await expect(page.getByRole("link", { name: /Sales console/i })).toBeVisible();
  });

  test("assist panel deep-links to Customer 360 for focused client", async ({ page }) => {
    await login(page, requireEnv("TEST_SALES_EMAIL"), requireEnv("TEST_SALES_PASSWORD"));
    await page.goto(`${getPreviewUrl()}/sales/dashboard`, { waitUntil: "domcontentloaded", timeout: 60_000 });

    const openAssist = page.getByRole("button", { name: "Open assist" }).first();
    await expect(openAssist).toBeVisible({ timeout: 30_000 });
    await openAssist.click();

    const customer360Link = page.getByTestId("sales-customer360-link");
    await expect(customer360Link).toBeVisible({ timeout: 10_000 });
    await customer360Link.click();

    await expect(page).toHaveURL(/\/sales\/clients\//);
    await expect(page.getByRole("heading", { name: /Customer 360/i })).toBeVisible({ timeout: 30_000 });
  });
});
