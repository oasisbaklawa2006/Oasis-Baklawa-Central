import { expect, test } from "@playwright/test";
import { getPreviewUrl, login } from "./e2e-helpers";
import {
  leap13HookSelector,
  MACRO_LEAP13_JOURNEY_HOOK_BINDINGS,
  MACRO_LEAP13_UAT_HOOK,
} from "../src/lib/macro-order-dispatch/macroLeap13PhysicalUatHooks";

const ADMIN_PREFIX = "TEST_ADMIN";

function hasAdminCredentials(): boolean {
  return Boolean(
    process.env[`${ADMIN_PREFIX}_EMAIL`]?.trim() && process.env[`${ADMIN_PREFIX}_PASSWORD`]?.trim(),
  );
}

function hasPreviewUrl(): boolean {
  return Boolean(process.env.TEST_PREVIEW_URL?.trim());
}

/**
 * Central #554 Leap 7 — software hook probe for Leap 13 physical UAT.
 * Confirms stable data-testid bindings exist; does NOT claim physical scanner/TV/gate PASS.
 */
test.describe("Macro Leap 13 UAT hooks — software probe", () => {
  test.skip(!hasAdminCredentials(), "Requires TEST_ADMIN_EMAIL and TEST_ADMIN_PASSWORD");
  test.skip(!hasPreviewUrl(), "Requires TEST_PREVIEW_URL");

  test.beforeEach(async ({ page }) => {
    const email = process.env[`${ADMIN_PREFIX}_EMAIL`]!.trim();
    const password = process.env[`${ADMIN_PREFIX}_PASSWORD`]!.trim();
    await login(page, email, password);
  });

  for (const binding of MACRO_LEAP13_JOURNEY_HOOK_BINDINGS) {
    test(`binds ${binding.stageKey} hook at ${binding.route}`, async ({ page }) => {
      await page.goto(`${getPreviewUrl()}${binding.route}`, {
        waitUntil: "domcontentloaded",
        timeout: 45_000,
      });
      await expect(page).not.toHaveURL(/\/login\/?(?:$|\?)/, { timeout: 15_000 });
      await expect(page.locator(leap13HookSelector(binding.hookId))).toBeVisible({ timeout: 15_000 });
    });
  }

  test("security gate exposes terminal chain hooks", async ({ page }) => {
    await page.goto(`${getPreviewUrl()}/security-gate`, {
      waitUntil: "domcontentloaded",
      timeout: 45_000,
    });
    await expect(page.locator(leap13HookSelector(MACRO_LEAP13_UAT_HOOK.SECURITY_GATE_SCANNER))).toBeVisible();
    await expect(page.locator(leap13HookSelector(MACRO_LEAP13_UAT_HOOK.SECURITY_GATE_DISPATCH_PROOF))).toBeVisible();
    await expect(page.locator(leap13HookSelector(MACRO_LEAP13_UAT_HOOK.SECURITY_GATE_COMPLAINT_WINDOW))).toBeVisible();
  });
});
