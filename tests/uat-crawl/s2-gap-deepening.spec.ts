/**
 * Targeted S2/S1 deepening for eight full-bleed authenticated surfaces.
 * Merges into UAT_MANIFEST_AUTH.jsonl without clearing prior tranche evidence.
 */
import { test, expect } from "@playwright/test";
import path from "node:path";
import { readFileSync, writeFileSync } from "node:fs";
import {
  crawlTargetAuthenticated,
  loadS2GapTargets,
  S2_GAP_TARGET_IDS,
  type AuthManifestRow,
} from "./auth-crawl";
import { appendFailureLedger, mergeAuthManifestRows, ROOT, writeTrancheIndex } from "./crawl-engine";

const MANIFEST_PATH = path.join(ROOT, "docs/uat-crawl/UAT_MANIFEST_AUTH.jsonl");
const INDEX_PATH = path.join(ROOT, "docs/uat-crawl/UAT_INDEX_S2_GAP_DEEPENING.md");
const SUMMARY_PATH = path.join(ROOT, "docs/uat-crawl/UAT_S2_GAP_DEEPENING_SUMMARY.json");
const FAILURE_PATH = path.join(ROOT, "docs/uat-crawl/UAT_FAILURE_LEDGER.md");
const TRANCHE = "s2-gap-deepening";

function trancheFolderFor(uatId: string): string {
  const rows = readFileSync(MANIFEST_PATH, "utf8")
    .trim()
    .split("\n")
    .filter(Boolean)
    .map((line) => JSON.parse(line) as AuthManifestRow);
  const prior = rows.find((row) => row.uatId === uatId);
  return prior?.tranche ?? TRANCHE;
}

const targets = loadS2GapTargets();
const rows: AuthManifestRow[] = [];
const allFailures: string[] = [];
const allUxFailures: string[] = [];

test.describe.configure({ mode: "serial" });

test.describe(`UAT crawl — ${TRANCHE} (${S2_GAP_TARGET_IDS.join(", ")})`, () => {
  for (const target of targets) {
    test(`${target.uatId} ${target.route} [${target.state}]`, async ({ page }) => {
      const folder = trancheFolderFor(target.uatId);
      const screenshotDir = path.join(ROOT, `uat-evidence/screenshots/${folder}`);
      const relPrefix = `uat-evidence/screenshots/${folder}`;
      const viewport = target.device === "phone" ? "390x844" : target.device === "tv" ? "1920x1080" : "1440x900";
      if (target.device === "phone") {
        await page.setViewportSize({ width: 390, height: 844 });
      } else if (target.device === "tv") {
        await page.setViewportSize({ width: 1920, height: 1080 });
      }

      const result = await crawlTargetAuthenticated(page, target, {
        screenshotDir,
        relPrefix,
        viewport,
        deviceLabel:
          target.device === "phone" ? "iphone-14" : target.device === "tv" ? "tv-1080p" : "desktop-chrome",
        trancheLabel: folder,
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
    const authenticated = rows.filter((row) => row.authenticated);
    const withS1 = authenticated.filter((row) => row.uxEvidence.s1);
    const withS2 = authenticated.filter((row) => row.uxEvidence.s2);
    const stillMissingS2 = authenticated.filter((row) => !row.uxEvidence.s2).map((row) => row.uatId);

    writeTrancheIndex(INDEX_PATH, TRANCHE, S2_GAP_TARGET_IDS.join(", "), rows, [
      "**Policy:** Full-bleed / TV / war-room S2 deepening — merges into existing manifest rows.",
      `**Authenticated:** ${authenticated.length} / ${rows.length}`,
      `**S1 captured this run:** ${withS1.length} / ${authenticated.length}`,
      `**S2 captured this run:** ${withS2.length} / ${authenticated.length}`,
      stillMissingS2.length > 0
        ? `**S2 still absent:** ${stillMissingS2.join(", ")} — no matching interactive control; NOT fabricated.`
        : "**All eight gap targets now have S2 evidence.**",
    ]);

    writeFileSync(
      SUMMARY_PATH,
      `${JSON.stringify(
        {
          generatedAt: new Date().toISOString(),
          tranche: TRANCHE,
          targetIds: S2_GAP_TARGET_IDS,
          authenticatedComplete: authenticated.map((row) => row.uatId),
          s1Captured: withS1.map((row) => row.uatId),
          s2Captured: withS2.map((row) => row.uatId),
          s2StillMissing: stillMissingS2,
          blockedTargets: rows.filter((row) => !row.authenticated).map((row) => ({
            uatId: row.uatId,
            missingSecretNames: row.missingSecretNames,
          })),
        },
        null,
        2,
      )}\n`,
    );

    if (allFailures.length > 0 || allUxFailures.length > 0) {
      appendFailureLedger(FAILURE_PATH, TRANCHE, allFailures, allUxFailures);
    }
  });
});