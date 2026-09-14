import { test, expect } from "@playwright/test";
import path from "node:path";
import {
  appendFailureLedger,
  appendManifestRow,
  crawlTarget,
  CRAWL_BASE_URL,
  ROOT,
  writeTrancheIndex,
  type CrawlTarget,
  type ManifestRow,
} from "./crawl-engine";
import { readFileSync } from "node:fs";

const TRANCHE = "tranche-02";
const UAT_RANGE = "UAT-0011..0020";
const SCREENSHOT_DIR = path.join(ROOT, "uat-evidence/screenshots/tranche-02");
const REL_PREFIX = "uat-evidence/screenshots/tranche-02";
const MANIFEST_PATH = path.join(ROOT, "docs/uat-crawl/UAT_MANIFEST.jsonl");
const INDEX_PATH = path.join(ROOT, "docs/uat-crawl/UAT_INDEX_TRANCHE_02.md");
const FAILURE_PATH = path.join(ROOT, "docs/uat-crawl/UAT_FAILURE_LEDGER.md");

const targets: CrawlTarget[] = JSON.parse(
  readFileSync(path.join(ROOT, "docs/uat-crawl/UAT_TRANCHE_02_TARGETS.json"), "utf8"),
);

const manifestRows: ManifestRow[] = [];
const allFailures: string[] = [];
const allUxFailures: string[] = [];

test.describe(`Appverse UAT crawl — ${TRANCHE} (${UAT_RANGE})`, () => {
  for (const target of targets) {
    test(`${target.uatId} ${target.route} [${target.state}]`, async ({ page }) => {
      const viewport = target.device === "phone" ? "390x844" : "1440x900";
      if (target.device === "phone") {
        await page.setViewportSize({ width: 390, height: 844 });
      }

      const result = await crawlTarget(page, target, {
        tranche: TRANCHE,
        screenshotDir: SCREENSHOT_DIR,
        relPrefix: REL_PREFIX,
        viewport,
        deviceLabel: target.device === "phone" ? "iphone-14" : "desktop-chrome",
      });

      manifestRows.push(result.row);
      allFailures.push(...result.failures);
      allUxFailures.push(...result.uxFailures);
      appendManifestRow(MANIFEST_PATH, result.row);
      expect(result.row.uxEvidence.s0).toBeTruthy();
    });
  }

  test.afterAll(() => {
    writeTrancheIndex(INDEX_PATH, TRANCHE, UAT_RANGE, manifestRows, [
      "**Buyer sheet states (UAT-0018, UAT-0020):** function+UX **BLOCKED** pending P0 **#483** deploy — pre-fix physical evidence preserved under FAIL-481-* / FAIL-UX-481-*; re-test same UAT/FAIL IDs only post-deploy.",
      "**Auth surfaces:** CREDENTIAL_REQUIRED — does not block unrelated Trace / Point41 / Dispatch crawl lanes.",
      `**Remaining untested after this tranche:** 111 / 131 (UAT-0021..UAT-0131).`,
    ]);
    appendFailureLedger(FAILURE_PATH, TRANCHE, allFailures, allUxFailures);
  });
});

test.describe.configure({ mode: "serial" });
