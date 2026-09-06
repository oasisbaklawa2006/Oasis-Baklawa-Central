import { expect, test } from "@playwright/test";
import { getPreviewUrl, login } from "./e2e-helpers";
import { getAiUatCase } from "../src/lib/ai-uat/catalogue";
import { probeForbiddenRoutes } from "./ai-uat/runtime";

const DISPATCH_PREFIX = "TEST_DISPATCH";

function hasDispatchCredentials(): boolean {
  return Boolean(
    process.env[`${DISPATCH_PREFIX}_EMAIL`]?.trim() && process.env[`${DISPATCH_PREFIX}_PASSWORD`]?.trim(),
  );
}

function hasPreviewUrl(): boolean {
  return Boolean(process.env.TEST_PREVIEW_URL?.trim());
}

test.describe("Dispatch RBAC — UAT-005 forbidden direct routes (browser path)", () => {
  test.skip(!hasDispatchCredentials(), "Requires TEST_DISPATCH_EMAIL and TEST_DISPATCH_PASSWORD");
  test.skip(!hasPreviewUrl(), "Requires TEST_PREVIEW_URL");

  test("DISPATCH_MANAGER cannot remain on Finance, governance, or accounts-release routes", async ({ page }) => {
    const email = process.env[`${DISPATCH_PREFIX}_EMAIL`]!.trim();
    const password = process.env[`${DISPATCH_PREFIX}_PASSWORD`]!.trim();

    await login(page, email, password);
    await page.goto(`${getPreviewUrl()}/admin/dispatch-mgmt`, { waitUntil: "domcontentloaded", timeout: 45_000 });
    await expect(page, "Authenticated account must access Dispatch Management").toHaveURL(
      /\/admin\/dispatch-mgmt\/?(?:$|\?)/,
      { timeout: 15_000 },
    );
    await expect(page.getByRole("heading", { name: /^Dispatch$/i })).toBeVisible();

    const testCase = getAiUatCase("UAT-005");
    const probes = await probeForbiddenRoutes(page, testCase);
    expect(probes.length).toBe(testCase.forbiddenRoutes.length);
  });
});
