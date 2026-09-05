import { test, expect } from "@playwright/test";
import path from "node:path";
import { writeFileSync } from "node:fs";
import {
  appendFailureLedger,
  appendManifestRow,
  crawlPostFix483Target,
  CRAWL_BASE_URL,
  POST_FIX_483_BASELINE_SHA,
  POST_FIX_483_TARGETS,
  PRE_FIX_FAIL_IDS,
  ROOT,
  writeTrancheIndex,
} from "./post-fix-483-crawl";

const SCREENSHOT_DIR = path.join(ROOT, "uat-evidence/screenshots/post-fix-483");
const REL_PREFIX = "uat-evidence/screenshots/post-fix-483";
const MANIFEST_PATH = path.join(ROOT, "docs/uat-crawl/UAT_MANIFEST_POST_FIX_483.jsonl");
const INDEX_PATH = path.join(ROOT, "docs/uat-crawl/UAT_INDEX_POST_FIX_483.md");
const SUMMARY_PATH = path.join(ROOT, "docs/uat-crawl/UAT_POST_FIX_483_SUMMARY.json");
const FAILURE_PATH = path.join(ROOT, "docs/uat-crawl/UAT_FAILURE_LEDGER.md");

const rows: Awaited<ReturnType<typeof crawlPostFix483Target>>["row"][] = [];
const allFailures: string[] = [];
const allClosed: string[] = [];

test.describe.configure({ mode: "serial" });

test.describe("Post-fix #483 buyer approval re-test (UAT-0018 + UAT-0020)", () => {
  test.beforeAll(() => {
    writeFileSync(MANIFEST_PATH, "");
  });

  for (const target of POST_FIX_483_TARGETS) {
    test(`${target.uatId} post-fix #483 ${target.route} [${target.state}]`, async ({ page }) => {
      await page.setViewportSize({ width: 390, height: 844 });

      const result = await crawlPostFix483Target(page, target, {
        screenshotDir: SCREENSHOT_DIR,
        relPrefix: REL_PREFIX,
        viewport: "390x844",
        deviceLabel: "iphone-14",
      });

      rows.push(result.row);
      allFailures.push(...result.failures);
      allClosed.push(...result.closedFailIds);
      appendManifestRow(MANIFEST_PATH, result.row);

      if (result.row.authenticated && result.row.uxEvidence.s0) {
        expect(result.row.uxEvidence.s0).toContain("post-fix-483");
      }
    });
  }

  test.afterAll(() => {
    const complete = rows.filter((r) => r.authenticated && r.uxEvidence.s3);
    const blocked = rows.filter((r) => !r.authenticated);
    const closedSet = [...new Set(allClosed)];

    writeTrancheIndex(INDEX_PATH, "post-fix-483", "UAT-0018 + UAT-0020 (#483 deploy ace340fe)", rows, [
      "**Pre-fix evidence preserved** in `tranche-02/` — not overwritten.",
      `**Post-fix deploy SHA:** \`${POST_FIX_483_BASELINE_SHA}\``,
      `**Re-tested FAIL-IDs:** ${PRE_FIX_FAIL_IDS.join(", ")}`,
      `**Authenticated S0–S3 complete:** ${complete.length} / ${rows.length}`,
      blocked.length > 0
        ? `**Blocked:** missing TEST_SALES_EMAIL / TEST_SALES_PASSWORD and/or TEST_PREVIEW_URL — dispatch GHA workflow on main deploy URL.`
        : "**Credentials present — post-fix evidence captured.**",
      closedSet.length > 0 ? `**CLOSED post-fix:** ${closedSet.join(", ")}` : "**No FAIL-IDs closed yet** — run with secrets on production/preview at ace340fe.",
      "**S3 rule:** Approve & Activate enabled evidence only — button NOT clicked (HUMAN-GATED).",
    ]);

    writeFileSync(
      SUMMARY_PATH,
      `${JSON.stringify(
        {
          generatedAt: new Date().toISOString(),
          postFixDeploySha: POST_FIX_483_BASELINE_SHA,
          crawlBaseUrl: CRAWL_BASE_URL,
          targets: POST_FIX_483_TARGETS.map((t) => t.uatId),
          preFixFailIds: PRE_FIX_FAIL_IDS,
          authenticatedComplete: complete.map((r) => r.uatId),
          blockedTargets: blocked.map((r) => ({
            uatId: r.uatId,
            missingSecretNames: r.missingSecretNames,
          })),
          closedFailIds: closedSet,
          retestDispositionByUatId: Object.fromEntries(rows.map((r) => [r.uatId, r.retestDisposition])),
          humanGated: true,
          remainingUntested: 111,
        },
        null,
        2,
      )}\n`,
    );

    appendFailureLedger(FAILURE_PATH, "post-fix-483 (#483 deploy ace340fe)", allFailures, []);
  });
});
