/**
 * FAST PATH B — #491 KPI regression proof (NOT current-main certification).
 * Exact PR head: efd141944fd77aee58779209fe529497177d9118
 * Merge on main: 64a107dfc167be76673a3d18f177a72472dcb241
 * Uses governed synthetic pending fixture only — never mutates real customers.
 */
import { expect, test } from "@playwright/test";
import { writeFileSync, mkdirSync, appendFileSync } from "node:fs";
import path from "node:path";
import { login, getPreviewUrl } from "../e2e-helpers";
import { PENDING_APP_FIXTURE_ID } from "./post-fix-483-crawl";
import { ROOT, sha256File } from "./crawl-engine";
import { resolveCredentials, getCredentials } from "./credential-matrix";

const PROOF_SHA = process.env.FAST_PATH_491_SHA?.trim() || "efd141944fd77aee58779209fe529497177d9118";
const PROOF_DEPLOY_ID = process.env.FAST_PATH_491_DEPLOYMENT_ID?.trim() || "6289622998";
const MANIFEST = path.join(ROOT, "docs/uat-crawl/UAT_POST_MERGE_491_PROOF.jsonl");
const SUMMARY = path.join(ROOT, "docs/uat-crawl/UAT_POST_MERGE_491_SUMMARY.json");
const SCREENSHOT_DIR = path.join(ROOT, "uat-evidence/screenshots/post-merge-491-kpi");
const REL_PREFIX = "uat-evidence/screenshots/post-merge-491-kpi";

async function readKpi(page: import("@playwright/test").Page, label: string): Promise<number> {
  const card = page.locator("div.rounded-xl").filter({ has: page.getByText(label, { exact: true }) }).first();
  const raw = await card.locator("p.text-2xl").first().textContent();
  return Number(String(raw ?? "").trim());
}

function appendProof(row: Record<string, unknown>) {
  mkdirSync(path.dirname(MANIFEST), { recursive: true });
  appendFileSync(MANIFEST, `${JSON.stringify(row)}\n`, "utf8");
}

test.describe.configure({ mode: "serial" });

test("FAIL-485-001 / #491 KPI convergence on synthetic fixture", async ({ page }) => {
  const creds = resolveCredentials("ADMIN_SALES", "/admin/clients");
  const baseUrl = getPreviewUrl();
  const timestamp = new Date().toISOString();

  if (!creds.wired || creds.prefix !== "TEST_SALES") {
    appendProof({
      proof: "post-merge-491-kpi",
      failId: "FAIL-485-001",
      uatId: "UAT-0018",
      status: "BLOCKED",
      deploySha: PROOF_SHA,
      deploymentId: PROOF_DEPLOY_ID,
      crawlBaseUrl: baseUrl,
      missingSecretNames: creds.missingSecretNames.length ? creds.missingSecretNames : ["TEST_SALES_EMAIL", "TEST_SALES_PASSWORD"],
      notes: "FAST PATH B BLOCKED — no governed TEST_SALES_* for synthetic KPI proof.",
      timestamp,
    });
    writeFileSync(
      SUMMARY,
      `${JSON.stringify({ generatedAt: timestamp, status: "BLOCKED", reason: "missing TEST_SALES_*", deploySha: PROOF_SHA }, null, 2)}\n`,
    );
    test.skip(true, "BLOCKED — missing TEST_SALES_*");
    return;
  }

  const { email, password } = getCredentials("TEST_SALES");
  await page.setViewportSize({ width: 390, height: 844 });
  await login(page, email, password);
  await page.goto(`${baseUrl}/admin/clients`, { waitUntil: "domcontentloaded", timeout: 60_000 });
  await page.waitForTimeout(3000);

  const pendingBefore = await readKpi(page, "Pending Review");
  const approvedBefore = await readKpi(page, "Recently Approved");
  const activeBefore = await readKpi(page, "Total Active Directory");

  mkdirSync(SCREENSHOT_DIR, { recursive: true });
  const beforeShot = `${REL_PREFIX}/FAIL-485-001_kpi-before.png`;
  await page.screenshot({ path: path.join(ROOT, beforeShot), fullPage: true });

  const fixtureRow = page.locator(`tr:has-text("${PENDING_APP_FIXTURE_ID.slice(0, 8)}"), button:has-text("${PENDING_APP_FIXTURE_ID.slice(0, 8)}")`).first();
  if (!(await fixtureRow.isVisible().catch(() => false))) {
    appendProof({
      proof: "post-merge-491-kpi",
      failId: "FAIL-485-001",
      status: "BLOCKED",
      deploySha: PROOF_SHA,
      deploymentId: PROOF_DEPLOY_ID,
      crawlBaseUrl: baseUrl,
      kpiBefore: { pending: pendingBefore, approved: approvedBefore, active: activeBefore },
      notes: `Synthetic fixture ${PENDING_APP_FIXTURE_ID} not visible on pending tab — cannot prove KPI convergence without cert pending app.`,
      screenshot: beforeShot,
      screenshotSha256: sha256File(path.join(ROOT, beforeShot)),
      timestamp,
    });
    writeFileSync(
      SUMMARY,
      `${JSON.stringify({ generatedAt: timestamp, status: "BLOCKED", reason: "synthetic fixture absent", deploySha: PROOF_SHA }, null, 2)}\n`,
    );
    test.skip(true, "BLOCKED — synthetic fixture not on deploy");
    return;
  }

  await fixtureRow.click();
  await page.waitForTimeout(1500);

  const pricingTrigger = page.locator('label:has-text("Pricing Slab")').locator("..").getByRole("combobox").first();
  if (await pricingTrigger.isVisible().catch(() => false)) {
    await pricingTrigger.click();
    await page.getByRole("option").first().click().catch(() => undefined);
  }
  const amTrigger = page.locator('label:has-text("Account Manager")').locator("..").getByRole("combobox").first();
  if (await amTrigger.isVisible().catch(() => false)) {
    await amTrigger.click();
    await page.getByRole("option").first().click().catch(() => undefined);
  }

  const approveBtn = page.getByRole("button", { name: /approve & activate/i }).first();
  const approveEnabled = await approveBtn.isEnabled().catch(() => false);
  if (!approveEnabled) {
    appendProof({
      proof: "post-merge-491-kpi",
      failId: "FAIL-485-001",
      status: "FAIL",
      deploySha: PROOF_SHA,
      crawlBaseUrl: baseUrl,
      kpiBefore: { pending: pendingBefore, approved: approvedBefore, active: activeBefore },
      notes: "Approve & Activate not enabled on synthetic fixture — cannot complete governed KPI proof.",
      timestamp,
    });
    expect(approveEnabled, "Approve must be enabled on synthetic fixture").toBe(true);
    return;
  }

  await approveBtn.click();
  await page.waitForTimeout(4000);

  const pendingAfter = await readKpi(page, "Pending Review");
  const approvedAfter = await readKpi(page, "Recently Approved");
  const activeAfter = await readKpi(page, "Total Active Directory");

  const afterShot = `${REL_PREFIX}/FAIL-485-001_kpi-after.png`;
  await page.screenshot({ path: path.join(ROOT, afterShot), fullPage: true });

  const pendingListEmpty = (await page.getByText(/no pending applications|no pending/i).count()) > 0;
  const kpiConverged =
    pendingAfter === Math.max(0, pendingBefore - 1) &&
    approvedAfter >= approvedBefore + 1 &&
    activeAfter >= activeBefore;

  const status = kpiConverged && pendingListEmpty ? "PASS" : "FAIL";

  appendProof({
    proof: "post-merge-491-kpi",
    failId: "FAIL-485-001",
    uatId: "UAT-0018",
    status,
    deploySha: PROOF_SHA,
    deploymentId: PROOF_DEPLOY_ID,
    mergeSha: "64a107dfc167be76673a3d18f177a72472dcb241",
    crawlBaseUrl: baseUrl,
    fixtureId: PENDING_APP_FIXTURE_ID,
    kpiBefore: { pending: pendingBefore, approved: approvedBefore, active: activeBefore },
    kpiAfter: { pending: pendingAfter, approved: approvedAfter, active: activeAfter },
    pendingListEmpty,
    screenshots: { before: beforeShot, after: afterShot },
    screenshotSha256: {
      before: sha256File(path.join(ROOT, beforeShot)),
      after: sha256File(path.join(ROOT, afterShot)),
    },
    notes: status === "PASS" ? "#491 KPI cards converged after synthetic approval." : "KPI cards did not converge immediately after synthetic approval.",
    notCurrentMainCertification: true,
    timestamp,
  });

  writeFileSync(
    SUMMARY,
    `${JSON.stringify(
      {
        generatedAt: timestamp,
        status,
        deploySha: PROOF_SHA,
        deploymentId: PROOF_DEPLOY_ID,
        kpiBefore: { pending: pendingBefore, approved: approvedBefore, active: activeBefore },
        kpiAfter: { pending: pendingAfter, approved: approvedAfter, active: activeAfter },
      },
      null,
      2,
    )}\n`,
  );

  expect(status, "FAIL-485-001 KPI convergence after synthetic approval").toBe("PASS");
});
