import { test, expect } from "@playwright/test";
import { compareExactDestination, resolveJobShortId } from "../src/lib/factoryCertificationHelpers";
import { factoryCertificationCredentialSpec } from "../src/lib/factoryCertificationCredentialPolicy";
import {
  hasFactoryCertificationBackend,
  hasFactoryCertificationTarget,
  loginToFactoryCertificationTarget,
  readAuthoritativeProductionJobs,
  readFactoryCertificationCredentials,
  resolveFactoryCertificationTarget,
  verifyAuthenticatedRole,
} from "./factory-certification/support";

/**
 * GOVERNED PRODUCTION SOURCE-TRUTH CERTIFICATION
 *
 * Expected truth comes from an authenticated read of production_jobs using
 * the same QA identity as the UI session. The TV DOM is then compared against
 * those rows. A zero/zero UI comparison cannot pass: each controlled
 * certification department must have at least one seeded open job.
 */

const TV_CONTRACTS = [
  { route: "/tv/arabic-sweets", role: "PROD_ARABIC_SWEETS", department: "ARABIC_SWEETS", golden: true },
  { route: "/tv/chocolate", role: "PROD_CHOCOLATE", department: "CHOCOLATES_CONFECTIONERY", golden: false },
  { route: "/tv/fusion", role: "PROD_FUSION", department: "FUSION_SWEETS", golden: false },
  { route: "/tv/bakery", role: "PROD_BAKERY", department: "BAKERY", golden: false },
  { route: "/tv/nuts", role: "PROD_NUTS", department: "SEASONED_NUTS_MIXES", golden: false },
] as const;

const GOLDEN_SHORT_ID = (process.env.FACTORY_CERT_GOLDEN_JOB_SHORT_ID?.trim() || "E3ED28B0").toUpperCase();

for (const contract of TV_CONTRACTS) {
  test(`production_jobs -> ${contract.route} exact truth :: ${contract.role}`, async ({ page }) => {
    test.skip(!hasFactoryCertificationTarget(), "CERTIFICATION_ENV_REQUIRED: FACTORY_CERT_TARGET_URL missing");
    test.skip(!hasFactoryCertificationBackend(), "CERTIFICATION_ENV_REQUIRED: Factory certification Supabase backend missing");

    const credentialSpec = factoryCertificationCredentialSpec(contract.role);
    const credentials = readFactoryCertificationCredentials(contract.role);
    test.skip(!credentials, `CREDENTIAL_REQUIRED: ${credentialSpec.emailEnv} + ${credentialSpec.passwordEnv}`);

    await page.setViewportSize({ width: 1920, height: 1080 });
    await loginToFactoryCertificationTarget(page, credentials!);
    await verifyAuthenticatedRole(page, contract.role);

    const expectedRows = await readAuthoritativeProductionJobs(page, contract.department);
    expect(
      expectedRows.length,
      `CERTIFICATION_FIXTURE_REQUIRED: ${contract.department} needs at least one open production_jobs row; zero/zero truth is not accepted`,
    ).toBeGreaterThan(0);

    const target = resolveFactoryCertificationTarget();
    await page.goto(`${target}${contract.route}`, { waitUntil: "domcontentloaded", timeout: 60_000 });
    await expect(page.locator("[data-job-id]")).toHaveCount(expectedRows.length, { timeout: 30_000 });

    const destination = compareExactDestination(contract.route, page.url());
    expect(destination.passed, destination.reason).toBe(true);

    const actualIds = (await page.locator("[data-job-id]").evaluateAll((nodes) =>
      nodes.map((node) => node.getAttribute("data-job-id") ?? "").filter(Boolean).sort(),
    ));
    const expectedIds = expectedRows.map((row) => row.id).sort();
    expect(actualIds, `${contract.route} must project exactly the governed ${contract.department} open-job set`).toEqual(expectedIds);

    for (const row of expectedRows) {
      const card = page.locator(`[data-job-id="${row.id}"]`);
      await expect(card, `Missing governed production job ${row.id} on ${contract.route}`).toHaveCount(1);
      await expect(card).toHaveAttribute("data-canonical-department", contract.department);
      await expect(card).toHaveAttribute("data-job-status", row.status);
      await expect(card).toHaveAttribute("data-priority", String(row.priority ?? ""));
      await expect(card).toHaveAttribute("data-assigned-qty", String(row.assigned_qty));
      await expect(card).toHaveAttribute("data-produced-qty", String(row.produced_qty ?? 0));
    }

    if (contract.golden) {
      const goldenRows = expectedRows.filter((row) => row.id.slice(0, 8).toUpperCase() === GOLDEN_SHORT_ID);
      expect(
        goldenRows,
        `Golden controlled fixture ${GOLDEN_SHORT_ID} must exist in authoritative ARABIC_SWEETS production_jobs`,
      ).toHaveLength(1);

      const golden = goldenRows[0];
      const resolution = resolveJobShortId(GOLDEN_SHORT_ID, golden.id);
      expect(resolution.valid, resolution.reason).toBe(true);
      await expect(page.locator(`[data-job-short-id="${GOLDEN_SHORT_ID}"]`)).toHaveAttribute("data-job-id", golden.id);
    }
  });
}
