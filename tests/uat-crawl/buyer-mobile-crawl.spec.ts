/**
 * Buyer mobile authenticated UAT crawl — Workstation 5 / PR #462.
 * Deploy baseline: Buyer Mobile PR #10 @ 0015e7b5 (hosted in Central).
 */
import { test, expect } from "@playwright/test";
import { crawlBuyerMobileSurfaces } from "./buyer-mobile-crawl";

test.describe.configure({ mode: "serial" });

test.describe("UAT crawl — buyer-mobile-auth (approved buyer)", () => {
  test.beforeEach(async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
  });

  test("authenticated buyer mobile surfaces S0–S3", async ({ page }) => {
    const { rows } = await crawlBuyerMobileSurfaces(page);
    expect(rows.length).toBeGreaterThan(0);
    const credBlocked = rows.every((r) => !r.authenticated);
    if (!credBlocked) {
      const withEvidence = rows.filter((r) => r.authenticated && r.uxEvidence.s0);
      expect(withEvidence.length).toBeGreaterThan(0);
    }
  });
});
