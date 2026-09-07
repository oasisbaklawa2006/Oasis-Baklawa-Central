import { test, expect } from "@playwright/test";
import { getPreviewUrl, login, requireEnv } from "./e2e-helpers";

function hasMacroCrmCrossRoleCreds(): boolean {
  return Boolean(
    process.env.TEST_SALES_EMAIL?.trim() &&
      process.env.TEST_SALES_PASSWORD?.trim() &&
      process.env.TEST_OPERATOR_EMAIL?.trim() &&
      process.env.TEST_OPERATOR_PASSWORD?.trim(),
  );
}

/**
 * Macro CRM cross-role journey — salesperson ↔ operator boundaries and governed linkage.
 * Skips unless both sales and operator QA identities are configured.
 */
test.describe("Macro CRM cross-role journey", () => {
  test.beforeEach(() => {
    test.skip(
      !hasMacroCrmCrossRoleCreds(),
      "Set TEST_SALES_EMAIL, TEST_SALES_PASSWORD, TEST_OPERATOR_EMAIL, and TEST_OPERATOR_PASSWORD for cross-role macro CRM proof.",
    );
  });

  test("sales executive cannot reach operator inbox (role boundary)", async ({ page }) => {
    await login(page, requireEnv("TEST_SALES_EMAIL"), requireEnv("TEST_SALES_PASSWORD"));
    await page.goto(`${getPreviewUrl()}/admin/operator-inbox`, {
      waitUntil: "domcontentloaded",
      timeout: 60_000,
    });

    const onLogin = /\/login(\/|$|\?)/i.test(page.url());
    const restricted = await page.getByText(/Access Restricted|Access Denied|Unauthorized/i).first().isVisible().catch(() => false);
    const governance = await page.getByRole("region", { name: /Governance notice/i }).isVisible().catch(() => false);

    expect(onLogin || restricted || !governance).toBeTruthy();
  });

  test("sales Customer 360 communication deep link is operator-routable for admins only", async ({ browser }) => {
    test.skip(
      !process.env.TEST_MACRO_CRM_PACKET_ID?.trim(),
      "Set TEST_MACRO_CRM_PACKET_ID to a governed inbox packet UUID for deep-link lineage proof.",
    );

    const packetId = requireEnv("TEST_MACRO_CRM_PACKET_ID").toLowerCase();
    const salesContext = await browser.newContext();
    const salesPage = await salesContext.newPage();

    await login(salesPage, requireEnv("TEST_SALES_EMAIL"), requireEnv("TEST_SALES_PASSWORD"));
    await salesPage.goto(`${getPreviewUrl()}/sales/dashboard`, {
      waitUntil: "domcontentloaded",
      timeout: 60_000,
    });

    const view360 = salesPage.getByRole("link", { name: /View 360/i }).first();
    await expect(view360).toBeVisible({ timeout: 30_000 });
    await view360.click();
    await expect(salesPage.getByRole("heading", { name: /Customer 360/i })).toBeVisible({ timeout: 30_000 });
    await expect(salesPage.getByText(/WhatsApp order linkage/i)).toBeVisible();

    const operatorContext = await browser.newContext();
    const operatorPage = await operatorContext.newPage();
    await login(operatorPage, requireEnv("TEST_OPERATOR_EMAIL"), requireEnv("TEST_OPERATOR_PASSWORD"));
    await operatorPage.goto(`${getPreviewUrl()}/admin/operator-inbox?packet=${packetId}`, {
      waitUntil: "domcontentloaded",
      timeout: 60_000,
    });

    await expect(operatorPage.getByRole("region", { name: /Governance notice/i })).toBeVisible({
      timeout: 30_000,
    });

    await salesContext.close();
    await operatorContext.close();
  });
});
