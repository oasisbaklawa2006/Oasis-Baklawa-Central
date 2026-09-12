/**
 * Parameterized authenticated UAT tranche crawl.
 * Env: UAT_TRANCHE_START, UAT_TRANCHE_END, UAT_TRANCHE_LABEL (folder/index name).
 */
import { test, expect } from "@playwright/test";
import path from "node:path";
import { crawlTargetAuthenticated, type AuthManifestRow } from "./auth-crawl";
import {
  appendFailureLedger,
  appendManifestRow,
  loadTargetsFromCensus,
  ROOT,
  writeTrancheIndex,
} from "./crawl-engine";

const START = process.env.UAT_TRANCHE_START ?? "UAT-0031";
const END = process.env.UAT_TRANCHE_END ?? "UAT-0131";
const TRANCHE = process.env.UAT_TRANCHE_LABEL ?? `tranche-${START.slice(-4)}-${END.slice(-4)}-auth`;
const UAT_RANGE = `${START}..${END}`;

const SCREENSHOT_DIR = path.join(ROOT, `uat-evidence/screenshots/${TRANCHE}`);
const REL_PREFIX = `uat-evidence/screenshots/${TRANCHE}`;
const MANIFEST_PATH = path.join(ROOT, "docs/uat-crawl/UAT_MANIFEST_AUTH.jsonl");
const INDEX_PATH = path.join(ROOT, `docs/uat-crawl/UAT_INDEX_${TRANCHE.toUpperCase().replace(/-/g, "_")}.md`);
const FAILURE_PATH = path.join(ROOT, "docs/uat-crawl/UAT_FAILURE_LEDGER.md");

const targets = loadTargetsFromCensus(START, END);
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
      appendManifestRow(MANIFEST_PATH, result.row);

      if (result.row.authenticated) {
        expect(result.row.uxEvidence.s0).toBeTruthy();
      }
    });
  }

  test.afterAll(() => {
    const authenticated = rows.filter((r) => r.authenticated);
    const blocked = rows.filter((r) => !r.authenticated);
    const startNum = Number.parseInt(START.replace("UAT-", ""), 10);
    const endNum = Number.parseInt(END.replace("UAT-", ""), 10);
    const remaining = Math.max(0, 131 - endNum);

    writeTrancheIndex(INDEX_PATH, TRANCHE, UAT_RANGE, rows, [
      "Authenticated crawl only — login-gate captures do not satisfy function/UX for role surfaces.",
      `**Authenticated complete:** ${authenticated.length} / ${rows.length}`,
      blocked.length > 0
        ? `**Blocked:** ${[...new Set(blocked.flatMap((r) => r.missingSecretNames))].join(", ") || "credential/login/network"}`
        : "**All targets authenticated.**",
      remaining > 0
        ? `**Remaining after ${TRANCHE}:** ${remaining} / 131 (UAT-${String(endNum + 1).padStart(4, "0")}..0131).`
        : "**Census complete for configured range.**",
    ]);
    appendFailureLedger(FAILURE_PATH, TRANCHE, allFailures, allUxFailures);
  });
});
