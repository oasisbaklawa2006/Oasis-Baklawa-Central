import { test, expect } from "@playwright/test";
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

async function requireRole(page: Parameters<typeof loginToFactoryCertificationTarget>[0], role: string) {
  const spec = factoryCertificationCredentialSpec(role);
  const credentials = readFactoryCertificationCredentials(role);
  test.skip(!credentials, `CREDENTIAL_REQUIRED: ${spec.emailEnv} + ${spec.passwordEnv}`);
  await loginToFactoryCertificationTarget(page, credentials!);
  await verifyAuthenticatedRole(page, role);
}

test.describe("Factory Operations failure injection", () => {
  test.beforeEach(() => {
    test.skip(!hasFactoryCertificationTarget(), "CERTIFICATION_ENV_REQUIRED: FACTORY_CERT_TARGET_URL missing");
    test.skip(!hasFactoryCertificationBackend(), "CERTIFICATION_ENV_REQUIRED: Factory certification Supabase backend missing");
  });

  test("Production TV read failure is explicit, not a false empty queue", async ({ page }) => {
    await page.setViewportSize({ width: 1920, height: 1080 });
    await requireRole(page, "PROD_ARABIC_SWEETS");

    let intercepted = 0;
    await page.route("**/rest/v1/production_jobs*", async (route) => {
      intercepted += 1;
      await route.abort("failed");
    });

    const target = resolveFactoryCertificationTarget();
    await page.goto(`${target}/tv/arabic-sweets`, { waitUntil: "domcontentloaded", timeout: 60_000 });

    await expect.poll(() => intercepted, { timeout: 15_000 }).toBeGreaterThan(0);
    await expect(page.getByText(/Could not load/i)).toBeVisible({ timeout: 15_000 });
    await expect(page.getByText(/No Open Production Jobs/i)).toHaveCount(0);

    const destination = compareExactDestination("/tv/arabic-sweets", page.url());
    expect(destination.passed, destination.reason).toBe(true);
    expect((await page.locator("body").innerText()).trim().length).toBeGreaterThan(20);
  });

  test("Demand Planner reservation read failure is explicit, not zero shortage", async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await requireRole(page, "RGS_ADMIN");

    let intercepted = 0;
    await page.route("**/rest/v1/inventory_reservations*", async (route) => {
      intercepted += 1;
      await route.abort("failed");
    });

    const target = resolveFactoryCertificationTarget();
    await page.goto(`${target}/admin/production-demand-planner`, { waitUntil: "domcontentloaded", timeout: 60_000 });

    await expect.poll(() => intercepted, { timeout: 15_000 }).toBeGreaterThan(0);
    await expect(page.getByText(/Demand could not be read:/i)).toBeVisible({ timeout: 15_000 });
    await expect(page.getByText(/No open RGS shortage/i)).toHaveCount(0);

    const destination = compareExactDestination("/admin/production-demand-planner", page.url());
    expect(destination.passed, destination.reason).toBe(true);
    expect((await page.locator("body").innerText()).trim().length).toBeGreaterThan(20);
  });
});
