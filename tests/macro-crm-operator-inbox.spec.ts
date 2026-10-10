import { test, expect } from "@playwright/test";
import { getPreviewUrl, login, requireEnv } from "./e2e-helpers";

/**
 * Macro CRM operator journey — governed operator inbox reachability.
 * Skips unless TEST_OPERATOR_EMAIL / TEST_OPERATOR_PASSWORD are configured.
 */
test.describe("Macro CRM operator inbox journey", () => {
  test.beforeEach(() => {
    test.skip(
      !process.env.TEST_OPERATOR_EMAIL?.trim() || !process.env.TEST_OPERATOR_PASSWORD?.trim(),
      "Set TEST_OPERATOR_EMAIL and TEST_OPERATOR_PASSWORD for authenticated operator inbox proof.",
    );
  });

  test("operator lands on governed inbox with case lifecycle and draft sections", async ({ page }) => {
    await login(page, requireEnv("TEST_OPERATOR_EMAIL"), requireEnv("TEST_OPERATOR_PASSWORD"));
    await page.goto(`${getPreviewUrl()}/admin/operator-inbox`, {
      waitUntil: "domcontentloaded",
      timeout: 60_000,
    });

    await expect(page.getByRole("region", { name: /Governance notice/i })).toBeVisible({ timeout: 30_000 });
    await expect(page.getByText(/Read-only controls/i)).toBeVisible();
    await expect(page.getByText(/Sales order draft/i).first()).toBeVisible({ timeout: 30_000 });
  });
});
