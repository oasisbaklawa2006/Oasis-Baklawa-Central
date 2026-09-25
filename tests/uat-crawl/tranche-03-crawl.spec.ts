import { test, expect } from "@playwright/test";
import path from "node:path";
import { writeFileSync } from "node:fs";
import { crawlTargetAuthenticated, type AuthManifestRow } from "./auth-crawl";
import {
  appendFailureLedger,
  appendManifestRow,
  loadTargetsFromCensus,
  writeTrancheIndex,
} from "./crawl-engine";

const TRANCHE = "tranche-03-auth";
const UAT_RANGE = "UAT-0021..0030";
const ROOT = path.resolve(import.meta.dirname, "../..");
const SCREENSHOT_DIR = path.join(ROOT, "uat-evidence/screenshots/tranche-03-auth");
const REL_PREFIX = "uat-evidence/screenshots/tranche-03-auth";
const MANIFEST_PATH = path.join(ROOT, "docs/uat-crawl/UAT_MANIFEST_AUTH.jsonl");
const INDEX_PATH = path.join(ROOT, "docs/uat-crawl/UAT_INDEX_TRANCHE_03_AUTH.md");
const FAILURE_PATH = path.join(ROOT, "docs/uat-crawl/UAT_FAILURE_LEDGER.md");

const targets = loadTargetsFromCensus("UAT-0021", "UAT-0030");
const rows: AuthManifestRow[] = [];
const allFailures: string[] = [];
const allUxFailures: string[] = [];

test.describe.configure({ mode: "serial" });

test.describe(`UAT crawl — ${TRANCHE} (${UAT_RANGE}) authenticated`, () => {
  for (const target of targets) {
    test(`${target.uatId} ${target.route} [${target.state}]`, async ({ page }) => {
      const viewport = target.device === "phone" ? "390x844" : "1440x900";
      if (target.device === "phone") {
        await page.setViewportSize({ width: 390, height: 844 });
      }

      const result = await crawlTargetAuthenticated(page, target, {
        screenshotDir: SCREENSHOT_DIR,
        relPrefix: REL_PREFIX,
        viewport,
        deviceLabel: target.device === "phone" ? "iphone-14" : "desktop-chrome",
      });

      rows.push(result.row);
      allFailures.push(...result.failures);
      allUxFailures.push(...result.uxFailures);
      appendManifestRow(MANIFEST_PATH, result.row);
      if (result.row.authenticated) expect(result.row.uxEvidence.s0).toBeTruthy();
    });
  }

  test.afterAll(() => {
    writeTrancheIndex(INDEX_PATH, TRANCHE, UAT_RANGE, rows, [
      "Authenticated crawl only — login-gate captures do not satisfy function/UX for role surfaces.",
      `**Remaining after tranche 03:** 101 / 131 (UAT-0031..0131).`,
    ]);
    appendFailureLedger(FAILURE_PATH, TRANCHE, allFailures, allUxFailures);
  });
});
