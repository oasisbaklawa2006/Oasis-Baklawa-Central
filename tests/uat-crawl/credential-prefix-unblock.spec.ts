/**
 * Targeted authenticated crawl for Gate / RGS / 3PGS surfaces after credential-prefix alias fix.
 * Preserves prior BLOCKED manifest rows via mergeAuthManifestRows (append-only by uatId).
 */
import { test, expect } from "@playwright/test";
import path from "node:path";
import { readFileSync, writeFileSync } from "node:fs";
import { crawlTargetAuthenticated, loadTargetsByIds, type AuthManifestRow } from "./auth-crawl";
import {
  appendFailureLedger,
  mergeAuthManifestRows,
  ROOT,
  writeTrancheIndex,
} from "./crawl-engine";

const TARGET_IDS: string[] = JSON.parse(
  readFileSync(path.join(ROOT, "docs/uat-crawl/UAT_CREDENTIAL_PREFIX_UNBLOCK_TARGETS.json"), "utf8"),
);

const TRANCHE = "credential-prefix-unblock";
const SCREENSHOT_DIR = path.join(ROOT, `uat-evidence/screenshots/${TRANCHE}`);
const REL_PREFIX = `uat-evidence/screenshots/${TRANCHE}`;
const MANIFEST_PATH = path.join(ROOT, "docs/uat-crawl/UAT_MANIFEST_AUTH.jsonl");
const INDEX_PATH = path.join(ROOT, "docs/uat-crawl/UAT_INDEX_CREDENTIAL_PREFIX_UNBLOCK.md");
const SUMMARY_PATH = path.join(ROOT, "docs/uat-crawl/UAT_CREDENTIAL_PREFIX_UNBLOCK_SUMMARY.json");
const FAILURE_PATH = path.join(ROOT, "docs/uat-crawl/UAT_FAILURE_LEDGER.md");

const targets = loadTargetsByIds(TARGET_IDS);
const rows: AuthManifestRow[] = [];
const allFailures: string[] = [];
const allUxFailures: string[] = [];

test.describe.configure({ mode: "serial" });

test.describe(`UAT credential-prefix-unblock (${TARGET_IDS.join(", ")})`, () => {
  for (const target of targets) {
    test(`${target.uatId} ${target.route} [${target.state}]`, async ({ page }) => {
      const viewport = target.device === "phone" ? "390x844" : "1440x900";
      if (target.device === "phone") {
        await page.setViewportSize({ width: 390, height: 844 });
      } else if (target.device === "tv") {
        await page.setViewportSize({ width: 1920, height: 1080 });
      }

      const result = await crawlTargetAuthenticated(page, target, {
        screenshotDir: SCREENSHOT_DIR,
        relPrefix: REL_PREFIX,
        viewport,
        deviceLabel:
          target.device === "phone" ? "iphone-14" : target.device === "tv" ? "tv-1080p" : "desktop-chrome",
        trancheLabel: TRANCHE,
      });

      rows.push(result.row);
      allFailures.push(...result.failures);
      allUxFailures.push(...result.uxFailures);

      if (result.row.authenticated) {
        expect(result.row.uxEvidence.s0).toBeTruthy();
      }
    });
  }

  test.afterAll(() => {
    mergeAuthManifestRows(MANIFEST_PATH, rows);
    const authenticated = rows.filter((r) => r.authenticated);
    const blocked = rows.filter((r) => !r.authenticated);

    writeTrancheIndex(INDEX_PATH, TRANCHE, TARGET_IDS.join(", "), rows, [
      "Credential prefix aliases: TEST_GATE|TEST_GATE_SECURITY; TEST_3PGS|TEST_PRODUCTION.",
      `**Authenticated complete:** ${authenticated.length} / ${rows.length}`,
      blocked.length > 0
        ? `**Still blocked:** ${[...new Set(blocked.flatMap((r) => r.missingSecretNames))].join(", ") || "credential/login/deploy"}`
        : "**All targets authenticated.**",
    ]);
    appendFailureLedger(FAILURE_PATH, TRANCHE, allFailures, allUxFailures);

    const summary = {
      generatedAt: new Date().toISOString(),
      tranche: TRANCHE,
      targetIds: TARGET_IDS,
      authenticatedComplete: authenticated.length,
      blocked: blocked.length,
      authenticatedIds: authenticated.map((r) => r.uatId),
      blockedIds: blocked.map((r) => r.uatId),
      blockedSecretNames: [...new Set(blocked.flatMap((r) => r.missingSecretNames))].sort(),
    };
    writeFileSync(SUMMARY_PATH, `${JSON.stringify(summary, null, 2)}\n`);
  });
});
