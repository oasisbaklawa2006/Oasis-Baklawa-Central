import { test, expect } from "@playwright/test";
import {
  BUYER_GOLDEN_PATH_VIEWPORTS,
  resolveBuyerCertificationTarget,
  requireBuyerCredentials,
  runBuyerGoldenPath,
  writeGoldenPathEvidence,
} from "./buyer-certification/support";

test.describe.configure({ mode: "serial" });

for (const viewport of BUYER_GOLDEN_PATH_VIEWPORTS) {
  test(`authenticated Buyer golden path @ ${viewport.width}px`, async ({ page }) => {
    requireBuyerCredentials();
    const targetUrl = resolveBuyerCertificationTarget();
    await page.setViewportSize({ width: viewport.width, height: viewport.height });

    const evidence = await runBuyerGoldenPath(page, targetUrl, viewport);
    writeGoldenPathEvidence(evidence, `buyer-golden-path-evidence-${viewport.name}.json`);

    expect(evidence.status, JSON.stringify(evidence.steps, null, 2)).toBe("PASS");
    expect(evidence.steps.map((step) => step.step)).toEqual([
      "login",
      "dashboard",
      "product_detail",
      "cart",
      "checkout_submit_order_detail",
      "documents_statement",
      "documents",
      "communication_log",
      "communication_log_count",
      "logout",
    ]);
  });
}
