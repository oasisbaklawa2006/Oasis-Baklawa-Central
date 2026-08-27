import { test, expect, type Page } from "@playwright/test";
import { compareExactDestination } from "../src/lib/factoryCertificationHelpers";
import { factoryCertificationCredentialSpec } from "../src/lib/factoryCertificationCredentialPolicy";
import {
  hasFactoryCertificationBackend,
  hasFactoryCertificationTarget,
  loginToFactoryCertificationTarget,
  readFactoryCertificationCredentials,
  resolveFactoryCertificationTarget,
  verifyAuthenticatedRole,
} from "./factory-certification/support";

/**
 * READ-ONLY FAILURE-INJECTION CERTIFICATION
 *
 * Requests are aborted in the browser only. No database mutation is performed.
 * A backend read failure must surface an explicit error and must never be
 * converted into a successful zero/empty state.
 */

async function requireRole(page: Page, role: string) {
  const spec = factoryCertificationCredentialSpec(role);
  const credentials = readFactoryCertificationCredentials(role);
  test.skip(!credentials, `CREDENTIAL_REQUIRED: ${spec.emailEnv} + ${spec.passwordEnv}`);
  await loginToFactoryCertificationTarget(page, credentials!);
  await verifyAuthenticatedRole(page, role);
}

async function assertReadFailureIsExplicit(
  page: Page,
  options: {
    viewport: { width: number; height: number };
    role: string;
    restPattern: string;
    route: string;
    explicitErrorText: RegExp;
    falseEmptyStateText: RegExp;
  },
) {
  await page.setViewportSize(options.viewport);
  await requireRole(page, options.role);

  let intercepted = 0;
  await page.route(options.restPattern, async (route) => {
    intercepted += 1;
    await route.abort("failed");
  });

  const target = resolveFactoryCertificationTarget();
  await page.goto(`${target}${options.route}`, { waitUntil: "domcontentloaded", timeout: 60_000 });

  await expect.poll(() => intercepted, { timeout: 15_000 }).toBeGreaterThan(0);
  await expect(page.getByText(options.explicitErrorText)).toBeVisible({ timeout: 15_000 });
  await expect(page.getByText(options.falseEmptyStateText)).toHaveCount(0);

  const destination = compareExactDestination(options.route, page.url());
  expect(destination.passed, destination.reason).toBe(true);
  expect((await page.locator("body").innerText()).trim().length).toBeGreaterThan(20);
}

test.describe("Factory Operations failure injection", () => {
  test.beforeEach(() => {
    test.skip(!hasFactoryCertificationTarget(), "CERTIFICATION_ENV_REQUIRED: FACTORY_CERT_TARGET_URL missing");
    test.skip(!hasFactoryCertificationBackend(), "CERTIFICATION_ENV_REQUIRED: Factory certification Supabase backend missing");
  });

  test("Production TV read failure is explicit, not a false empty queue", async ({ page }) => {
    await assertReadFailureIsExplicit(page, {
      viewport: { width: 1920, height: 1080 },
      role: "PROD_ARABIC_SWEETS",
      restPattern: "**/rest/v1/production_jobs*",
      route: "/tv/arabic-sweets",
      explicitErrorText: /Could not load/i,
      falseEmptyStateText: /No Open Production Jobs/i,
    });
  });

  test("Demand Planner reservation read failure is explicit, not zero shortage", async ({ page }) => {
    await assertReadFailureIsExplicit(page, {
      viewport: { width: 1440, height: 900 },
      role: "RGS_ADMIN",
      restPattern: "**/rest/v1/inventory_reservations*",
      route: "/admin/production-demand-planner",
      explicitErrorText: /Demand could not be read:/i,
      falseEmptyStateText: /No open RGS shortage/i,
    });
  });
});
