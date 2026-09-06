/**
 * Post-#497 current-main FAIL-493-001 (UAT-005) visual + function evidence.
 * Append-only — preserves pre-fix FAIL @ 8f042fa and preview PASS @ 9715c20d.
 */
import { expect, test } from "@playwright/test";
import { createHash } from "node:crypto";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { getAiUatCase } from "../../src/lib/ai-uat/catalogue";
import { getPreviewUrl, login } from "../e2e-helpers";
import { openAllTools, probeForbiddenRoutes } from "../ai-uat/runtime";
import {
  appendManifestRow,
  CURRENT_MAIN_SHA,
  CRAWL_BASE_URL,
  ROOT,
  sha256File,
} from "./crawl-engine";

const TRANCHE = "post-merge-497-main";
const SCREENSHOT_DIR = path.join(ROOT, "uat-evidence/screenshots/post-merge-497-main");
const REL_PREFIX = "uat-evidence/screenshots/post-merge-497-main";
const MANIFEST_PATH = path.join(ROOT, "docs/uat-crawl/UAT_MANIFEST_POST_MERGE_497_MAIN.jsonl");
const PROOF_PATH = path.join(ROOT, "docs/uat-crawl/UAT_POST_MERGE_493_PROOF.jsonl");
const SUMMARY_PATH = path.join(ROOT, "docs/uat-crawl/UAT_POST_MERGE_497_MAIN_SUMMARY.json");
const INDEX_PATH = path.join(ROOT, "docs/uat-crawl/UAT_INDEX_POST_MERGE_497_MAIN.md");

const MERGE_SHA = process.env.POST_MERGE_497_MAIN_SHA?.trim() || CURRENT_MAIN_SHA;
const DEPLOY_ID = process.env.POST_MERGE_497_DEPLOYMENT_ID?.trim() || "";
const RUN_ID = process.env.GITHUB_RUN_ID || "local";

function shotName(phase: string, label: string) {
  return `UAT-005_central_dispatch_manager_fail-493-001_${phase}-${label}.png`;
}

async function capture(page: import("@playwright/test").Page, filename: string) {
  mkdirSync(SCREENSHOT_DIR, { recursive: true });
  const abs = path.join(SCREENSHOT_DIR, filename);
  await page.screenshot({ path: abs, fullPage: true, timeout: 30_000 });
  const rel = `${REL_PREFIX}/${filename}`;
  return { rel, abs, sha256: sha256File(abs) };
}

function appendProof(row: Record<string, unknown>) {
  writeFileSync(PROOF_PATH, `${JSON.stringify(row)}\n`, { flag: "a" });
}

test.describe(`UAT post-merge #497 main — FAIL-493-001 (UAT-005) @ ${MERGE_SHA.slice(0, 8)}`, () => {
  test("UAT-005 Dispatch Finance isolation with S0–S3 visual evidence", async ({ page }) => {
    const testCase = getAiUatCase("UAT-005");
    const email = process.env.TEST_DISPATCH_EMAIL?.trim();
    const password = process.env.TEST_DISPATCH_PASSWORD?.trim();
    if (!email || !password) {
      appendProof({
        proof: "post-merge-497-main-cert",
        uatId: "UAT-005",
        failId: "FAIL-493-001",
        runId: RUN_ID,
        mergeSha: MERGE_SHA,
        crawlBaseUrl: CRAWL_BASE_URL,
        status: "BLOCKED",
        missingSecretNames: ["TEST_DISPATCH_EMAIL", "TEST_DISPATCH_PASSWORD"],
        timestamp: new Date().toISOString(),
        preservesPriorFailEvidence: true,
        notSubstitutingPreviewPass: "9715c20d run 34016393457 preserved separately",
      });
      test.skip(true, "Missing TEST_DISPATCH_*");
      return;
    }

    await login(page, email, password);
    await page.goto(`${getPreviewUrl()}/admin/dispatch-mgmt`, { waitUntil: "domcontentloaded", timeout: 60_000 });
    await page.waitForTimeout(3500);
    await expect(page).toHaveURL(/\/admin\/dispatch-mgmt/, { timeout: 15_000 });
    await expect(page.getByRole("heading", { name: /^Dispatch$/i })).toBeVisible({ timeout: 15_000 });

    const s0 = await capture(page, shotName("S0", "dispatch-default-settled"));
    const nav = await openAllTools(page);
    for (const label of testCase.forbiddenVisible) {
      await expect(nav.getByText(label, { exact: false }), `Dispatch must not be offered ${label}`).toHaveCount(0);
    }
    const s1 = await capture(page, shotName("S1", "all-tools-no-finance"));

    await page.goto(`${getPreviewUrl()}/admin/finance`, { waitUntil: "domcontentloaded", timeout: 60_000 });
    const s2 = await capture(page, shotName("S2", "forbidden-finance-probe"));
    await expect
      .poll(() => new URL(page.url()).pathname.replace(/\/+$/, "") || "/", {
        message: "UAT-005: /admin/finance must not remain on forbidden route",
        timeout: 10_000,
      })
      .not.toBe("/admin/finance");
    await expect(page.getByText(/Finance queue|Accounts & Release|Finance governance/i)).toHaveCount(0);

    const probes = await probeForbiddenRoutes(page, testCase);
    const s3 = await capture(page, shotName("S3", "forbidden-routes-settled"));

    const manifestRow = {
      uatId: "UAT-005",
      failId: "FAIL-493-001",
      tranche: TRANCHE,
      screenshot: s0.rel,
      screenshotSha256: s0.sha256,
      route: "/admin/dispatch-mgmt",
      forbiddenRoute: "/admin/finance",
      state: "default",
      role: "DISPATCH_MANAGER",
      viewport: "1440x900",
      device: "desktop-chrome",
      baselineSha: MERGE_SHA,
      crawlBaseUrl: CRAWL_BASE_URL,
      timestamp: new Date().toISOString(),
      visualStatus: "OBSERVED",
      functionStatus: "OBSERVED",
      uxStatus: "PARTIAL",
      uxEvidence: { s0: s0.rel, s1: s1.rel, s2: s2.rel, s3: s3.rel },
      uxEvidenceSha256: { s0: s0.sha256, s1: s1.sha256, s2: s2.sha256, s3: s3.sha256 },
      functionResult: probes.join("; "),
      disposition: "PASS",
      notes: `Current-main #497 merge cert @ ${MERGE_SHA.slice(0, 8)} — NOT substituting 9715c20d preview PASS`,
    };
    appendManifestRow(MANIFEST_PATH, manifestRow as never);
    appendProof({
      proof: "post-merge-497-main-cert",
      uatId: "UAT-005",
      failId: "FAIL-493-001",
      runId: RUN_ID,
      mergeSha: MERGE_SHA,
      githubDeploymentId: DEPLOY_ID,
      crawlBaseUrl: CRAWL_BASE_URL,
      status: "PASS",
      role: "DISPATCH_MANAGER",
      finalUrl: page.url(),
      actual: `Finance navigation absent; direct probes: ${probes.join("; ")}`,
      severity: "P1",
      timestamp: new Date().toISOString(),
      currentMainCertification: true,
      preservesPriorFailEvidence: true,
      notSubstitutingPreviewPass: "9715c20d run 34016393457 preserved separately",
      screenshots: [s0.rel, s1.rel, s2.rel, s3.rel],
    });

    writeFileSync(
      SUMMARY_PATH,
      `${JSON.stringify(
        {
          generatedAt: new Date().toISOString(),
          runId: RUN_ID,
          mergeSha: MERGE_SHA,
          crawlBaseUrl: CRAWL_BASE_URL,
          uatId: "UAT-005",
          failId: "FAIL-493-001",
          disposition: "PASS",
          probes,
          screenshots: manifestRow.uxEvidence,
          checksums: manifestRow.uxEvidenceSha256,
        },
        null,
        2,
      )}\n`,
    );

    const indexLines = [
      `# UAT Post-Merge #497 Main — FAIL-493-001 (UAT-005)`,
      "",
      `**Merge SHA:** \`${MERGE_SHA}\``,
      `**Deploy:** ${CRAWL_BASE_URL}`,
      `**Disposition:** PASS (current-main certification — preview 9715c20d preserved separately)`,
      "",
      "| Phase | Screenshot | SHA256 |",
      "|---|---|---|",
      ...(["s0", "s1", "s2", "s3"] as const).map((k) => {
        const rel = manifestRow.uxEvidence[k]!;
        const sha = manifestRow.uxEvidenceSha256[k]!;
        return `| ${k.toUpperCase()} | [${path.basename(rel)}](../../${rel}) | \`${sha.slice(0, 16)}…\` |`;
      }),
    ];
    writeFileSync(INDEX_PATH, `${indexLines.join("\n")}\n`);
  });
});
