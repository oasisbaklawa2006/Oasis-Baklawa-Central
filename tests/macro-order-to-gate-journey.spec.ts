import { expect, test } from "@playwright/test";
import { getPreviewUrl, login } from "./e2e-helpers";
import {
  MACRO_AMENDMENT_SURFACE,
  MACRO_DISPATCH_MANAGER_HOME,
  MACRO_ORDER_DISPATCH_JOURNEY,
} from "../src/lib/macro-order-dispatch/macroOrderDispatchJourney";

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
 * Central #554 Leap 7 — synthetic browser census of the internal order-to-gate journey.
 * Read-only route reachability only; no physical scanner/TV/gate PASS claims.
 */
test.describe("Macro order-to-gate journey — synthetic route census", () => {
  test.skip(!hasAdminCredentials(), "Requires TEST_ADMIN_EMAIL and TEST_ADMIN_PASSWORD");
  test.skip(!hasPreviewUrl(), "Requires TEST_PREVIEW_URL");

  test.beforeEach(async ({ page }) => {
    const email = process.env[`${ADMIN_PREFIX}_EMAIL`]!.trim();
    const password = process.env[`${ADMIN_PREFIX}_PASSWORD`]!.trim();
    await login(page, email, password);
  });

  for (const stage of MACRO_ORDER_DISPATCH_JOURNEY) {
    test(`reaches ${stage.label} at ${stage.route}`, async ({ page }) => {
      await page.goto(`${getPreviewUrl()}${stage.route}`, {
        waitUntil: "domcontentloaded",
        timeout: 45_000,
      });
      await expect(page).not.toHaveURL(/\/login\/?(?:$|\?)/, { timeout: 15_000 });
      await expect(page.locator("body")).not.toBeEmpty();
    });
  }

  test("central order pool shows priority/owner/SLA columns", async ({ page }) => {
    await page.goto(`${getPreviewUrl()}/admin/central-pool`, {
      waitUntil: "domcontentloaded",
      timeout: 45_000,
    });
    await expect(page.getByRole("heading", { name: /Central Order Pool/i })).toBeVisible();
    await expect(page.getByRole("columnheader", { name: /Priority/i })).toBeVisible();
    await expect(page.getByRole("columnheader", { name: /Owner/i })).toBeVisible();
    await expect(page.getByRole("columnheader", { name: /SLA/i })).toBeVisible();
  });

  test("security gate exposes customer dispatch communication controls", async ({ page }) => {
    await page.goto(`${getPreviewUrl()}/security-gate`, {
      waitUntil: "domcontentloaded",
      timeout: 45_000,
    });
    await expect(page.getByText(/Ticket-window handoff/i)).toBeVisible();
    await expect(page.getByText(/Freeze final gate-exit dispatch proof/i)).toBeVisible();
  });

  test("order management remains reachable for amendment surface", async ({ page }) => {
    await page.goto(`${getPreviewUrl()}${MACRO_AMENDMENT_SURFACE}`, {
      waitUntil: "domcontentloaded",
      timeout: 45_000,
    });
    await expect(page).not.toHaveURL(/\/login\/?(?:$|\?)/, { timeout: 15_000 });
  });
});

test.describe("Macro journey — Dispatch Manager least privilege", () => {
  const DISPATCH_PREFIX = "TEST_DISPATCH";

  test.skip(
    !process.env[`${DISPATCH_PREFIX}_EMAIL`]?.trim() || !process.env[`${DISPATCH_PREFIX}_PASSWORD`]?.trim(),
    "Requires TEST_DISPATCH_EMAIL and TEST_DISPATCH_PASSWORD",
  );
  test.skip(!hasPreviewUrl(), "Requires TEST_PREVIEW_URL");

  test("dispatch manager lands on dispatch-mgmt, not finance or central pool", async ({ page }) => {
    const email = process.env[`${DISPATCH_PREFIX}_EMAIL`]!.trim();
    const password = process.env[`${DISPATCH_PREFIX}_PASSWORD`]!.trim();
    await login(page, email, password);
    await page.goto(`${getPreviewUrl()}${MACRO_DISPATCH_MANAGER_HOME}`, {
      waitUntil: "domcontentloaded",
      timeout: 45_000,
    });
    await expect(page).toHaveURL(/\/admin\/dispatch-mgmt\/?(?:$|\?)/, { timeout: 15_000 });

    await page.goto(`${getPreviewUrl()}/admin/finance-board`, {
      waitUntil: "domcontentloaded",
      timeout: 45_000,
    });
    await expect(page).not.toHaveURL(/\/admin\/finance-board\/?(?:$|\?)/, { timeout: 15_000 });

    for (const blockedRoute of [
      "/operations-controller",
      "/admin/cmd-war-room",
      "/admin/heartbeat",
      "/admin/execution-command-center",
      "/admin/central-pool",
    ]) {
      await page.goto(`${getPreviewUrl()}${blockedRoute}`, {
        waitUntil: "domcontentloaded",
        timeout: 45_000,
      });
      await expect(page).not.toHaveURL(new RegExp(`${blockedRoute.replace(/\//g, "\\/")}\\/?(?:$|\\?)`), {
        timeout: 15_000,
      });
    }
  });
});
