/**
 * Public-surface continuation crawl on ace340fe deploy — unblocked routes only.
 * Preserves pre-auth tranche-01 evidence; append-only manifest on continuation deploy.
 */
import { test, expect } from "@playwright/test";
import { mkdirSync, readFileSync } from "node:fs";
import path from "node:path";
import {
  appendFailureLedger,
  appendManifestRow,
  crawlTarget,
  CRAWL_BASE_URL,
  LEGACY_483_DEPLOY_SHA,
  ROOT,
  type CrawlTarget,
  type ManifestRow,
  writeTrancheIndex,
} from "./crawl-engine";

const PUBLIC_CONTINUATION_IDS = ["UAT-0001", "UAT-0004", "UAT-0005", "UAT-0008", "UAT-0009"];
const TRANCHE = "public-continuation-ace340fe";
const SCREENSHOT_DIR = path.join(ROOT, "uat-evidence/screenshots/public-continuation");
const REL_PREFIX = "uat-evidence/screenshots/public-continuation";
const MANIFEST_PATH = path.join(ROOT, "docs/uat-crawl/UAT_MANIFEST_PUBLIC_CONTINUATION.jsonl");
const INDEX_PATH = path.join(ROOT, "docs/uat-crawl/UAT_INDEX_PUBLIC_CONTINUATION.md");
const FAILURE_PATH = path.join(ROOT, "docs/uat-crawl/UAT_FAILURE_LEDGER.md");

function loadPublicTargets(): CrawlTarget[] {
  const census = JSON.parse(
    readFileSync(path.join(ROOT, "docs/uat-crawl/UAT_ROUTE_CENSUS.json"), "utf8"),
  ) as { entries: CrawlTarget[] };
  const byId = new Map(census.entries.map((e) => [e.uatId, e]));
  return PUBLIC_CONTINUATION_IDS.map((id) => {
    const entry = byId.get(id);
    if (!entry) throw new Error(`Missing census entry for ${id}`);
    return entry;
  });
}

const rows: ManifestRow[] = [];
const functionalFailures: string[] = [];
const uxFailures: string[] = [];

mkdirSync(SCREENSHOT_DIR, { recursive: true });

test.describe(`UAT crawl — ${TRANCHE} (unblocked public surfaces)`, () => {
  for (const target of loadPublicTargets()) {
    test(`${target.uatId} ${target.route} [${target.state}]`, async ({ page }) => {
      const result = await crawlTarget(page, target, {
        tranche: TRANCHE,
        screenshotDir: SCREENSHOT_DIR,
        relPrefix: REL_PREFIX,
        viewport: "1440x900",
        deviceLabel: "desktop-chrome",
      });
      const row = {
        ...result.row,
        baselineSha: LEGACY_483_DEPLOY_SHA,
        crawlBaseUrl: CRAWL_BASE_URL,
        notes: `${result.row.notes} continuationDeploy=${LEGACY_483_DEPLOY_SHA} NOT current-main cert`.trim(),
      };
      rows.push(row);
      functionalFailures.push(...result.failures);
      uxFailures.push(...result.uxFailures);
      appendManifestRow(MANIFEST_PATH, row);
      expect(row.uxEvidence.s0).toBeTruthy();
    });
  }

  test.afterAll(() => {
    writeTrancheIndex(INDEX_PATH, TRANCHE, PUBLIC_CONTINUATION_IDS.join(", "), rows, [
      "**Provenance:** ace340fe continuation crawl — NOT current-main 64a107df certification.",
      "**Policy:** Pre-auth tranche-01 screenshots preserved append-only.",
    ]);
    if (functionalFailures.length > 0 || uxFailures.length > 0) {
      appendFailureLedger(FAILURE_PATH, TRANCHE, functionalFailures, uxFailures);
    }
  });
});
