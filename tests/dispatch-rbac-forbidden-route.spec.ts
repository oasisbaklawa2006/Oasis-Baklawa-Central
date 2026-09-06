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

test.describe("Dispatch RBAC — UAT-005 forbidden direct routes (browser path)", () => {
  test.skip(!hasDispatchCredentials(), "Requires TEST_DISPATCH_EMAIL and TEST_DISPATCH_PASSWORD");
  test.skip(!getPreviewUrl(), "Requires TEST_PREVIEW_URL or UAT_CRAWL_BASE_URL");

  test("DISPATCH_MANAGER cannot remain on Finance, governance, or accounts-release routes", async ({ page }) => {
    const email = process.env[`${DISPATCH_PREFIX}_EMAIL`]!.trim();
    const password = process.env[`${DISPATCH_PREFIX}_PASSWORD`]!.trim();

    await login(page, email, password);
    await page.goto(`${getPreviewUrl()}/admin/dispatch-mgmt`, { waitUntil: "domcontentloaded", timeout: 45_000 });

    const testCase = getAiUatCase("UAT-005");
    const probes = await probeForbiddenRoutes(page, testCase);
    expect(probes.length).toBe(testCase.forbiddenRoutes.length);
  });
});
