import { test, expect } from "@playwright/test";
import path from "node:path";
import { writeFileSync } from "node:fs";
import { crawlTargetAuthenticated, loadAuthRerunTargets, type AuthManifestRow } from "./auth-crawl";
import {
  appendFailureLedger,
  appendManifestRow,
  CRAWL_BASE_URL,
  ROOT,
  writeTrancheIndex,
} from "./crawl-engine";

const SCREENSHOT_DIR = path.join(ROOT, "uat-evidence/screenshots/auth-rerun");
const REL_PREFIX = "uat-evidence/screenshots/auth-rerun";
const MANIFEST_PATH = path.join(ROOT, "docs/uat-crawl/UAT_MANIFEST_AUTH.jsonl");
const INDEX_PATH = path.join(ROOT, "docs/uat-crawl/UAT_INDEX_AUTH_RERUN.md");
const SUMMARY_PATH = path.join(ROOT, "docs/uat-crawl/UAT_AUTH_RERUN_SUMMARY.json");
const FAILURE_PATH = path.join(ROOT, "docs/uat-crawl/UAT_FAILURE_LEDGER.md");

const targets = loadAuthRerunTargets();
const rows: AuthManifestRow[] = [];
const allFailures: string[] = [];
const allUxFailures: string[] = [];

test.describe.configure({ mode: "serial" });

test.describe("UAT authenticated auth-rerun (UAT-0002..0020 subset)", () => {
  test.beforeAll(() => {
    writeFileSync(MANIFEST_PATH, "");
  });

  for (const target of targets) {
    test(`${target.uatId} authenticated ${target.route} [${target.state}]`, async ({ page }) => {
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

      if (result.row.authenticated) {
        expect(result.row.uxEvidence.s0).toBeTruthy();
      }
    });
  }

  test.afterAll(() => {
    const authenticated = rows.filter((r) => r.authenticated);
    const blocked = rows.filter((r) => !r.authenticated);
    const blockedSecrets = [...new Set(blocked.flatMap((r) => r.missingSecretNames))].sort();

    writeTrancheIndex(INDEX_PATH, "auth-rerun", "UAT-0002..0020 (authenticated repair)", rows, [
      "**Pre-auth evidence preserved** in `tranche-01/` and `tranche-02/` — not overwritten.",
      `**Authenticated complete:** ${authenticated.length} / ${rows.length}`,
      blockedSecrets.length > 0
        ? `**Blocked secret names:** ${blockedSecrets.join(", ")}`
        : "**All required secrets present for this tranche.**",
    ]);

    writeFileSync(
      SUMMARY_PATH,
      `${JSON.stringify(
        {
          generatedAt: new Date().toISOString(),
          crawlBaseUrl: CRAWL_BASE_URL,
          totalTargets: rows.length,
          authenticatedComplete: authenticated.map((r) => r.uatId),
          blockedTargets: blocked.map((r) => ({
            uatId: r.uatId,
            missingSecretNames: r.missingSecretNames,
            credentialPrefix: r.credentialPrefix,
          })),
          blockedSecretNames: blockedSecrets,
          newFailIds: allFailures.map((line) => line.split("|")[1]?.trim()).filter(Boolean),
          remainingUntested: 111,
        },
        null,
        2,
      )}\n`,
    );

    appendFailureLedger(FAILURE_PATH, "auth-rerun (authenticated repair)", allFailures, allUxFailures);
  });
});
