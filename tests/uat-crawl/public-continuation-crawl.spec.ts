/**
 * Public-surface continuation crawl on exact current-main deploy — unblocked routes only.
 * Preserves prior manifest rows append-only via archive before merge.
 */
import { test, expect } from "@playwright/test";
import { appendFileSync, existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import {
  appendFailureLedger,
  crawlTarget,
  CRAWL_BASE_URL,
  CURRENT_MAIN_SHA,
  ROOT,
  type CrawlTarget,
  type ManifestRow,
  writeTrancheIndex,
} from "./crawl-engine";

const PUBLIC_CONTINUATION_IDS = ["UAT-0001", "UAT-0004", "UAT-0005", "UAT-0008", "UAT-0009"];
const TRANCHE = "public-continuation-current-main";
const SCREENSHOT_DIR = path.join(ROOT, "uat-evidence/screenshots/public-continuation");
const REL_PREFIX = "uat-evidence/screenshots/public-continuation";
const MANIFEST_PATH = path.join(ROOT, "docs/uat-crawl/UAT_MANIFEST_PUBLIC_CONTINUATION.jsonl");
const MANIFEST_ARCHIVE_PATH = path.join(
  ROOT,
  "docs/uat-crawl/UAT_MANIFEST_PUBLIC_CONTINUATION_ARCHIVE.jsonl",
);
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

function archivePriorManifest() {
  if (!existsSync(MANIFEST_PATH)) return;
  const prior = readFileSync(MANIFEST_PATH, "utf8").trim();
  if (!prior) return;
  appendFileSync(MANIFEST_ARCHIVE_PATH, `${prior}\n`);
}

function mergePublicManifestRows(updatedRows: ManifestRow[]) {
  archivePriorManifest();
  let existing: ManifestRow[] = [];
  try {
    existing = readFileSync(MANIFEST_PATH, "utf8")
      .trim()
      .split("\n")
      .filter(Boolean)
      .map((line) => JSON.parse(line) as ManifestRow);
  } catch {
    /* first run */
  }
  const updates = new Map(updatedRows.map((row) => [row.uatId, row]));
  const merged = existing
    .filter((row) => !updates.has(row.uatId))
    .concat(updatedRows);
  writeFileSync(MANIFEST_PATH, `${merged.map((row) => JSON.stringify(row)).join("\n")}\n`);
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
        baselineSha: CURRENT_MAIN_SHA,
        crawlBaseUrl: CRAWL_BASE_URL,
        notes: `${result.row.notes} currentMainDeploy=${CURRENT_MAIN_SHA} exact-SHA cert`.trim(),
      };
      rows.push(row);
      functionalFailures.push(...result.failures);
      uxFailures.push(...result.uxFailures);
      expect(row.uxEvidence.s0).toBeTruthy();
    });
  }

  test.afterAll(() => {
    mergePublicManifestRows(rows);
    writeTrancheIndex(INDEX_PATH, TRANCHE, PUBLIC_CONTINUATION_IDS.join(", "), rows, [
      `**Provenance:** exact current-main @ \`${CURRENT_MAIN_SHA}\` (#558) — prior ace340fe/6c7de2a rows archived append-only.`,
      "**Policy:** Pre-auth tranche-01 screenshots preserved append-only.",
    ]);
    if (functionalFailures.length > 0 || uxFailures.length > 0) {
      appendFailureLedger(FAILURE_PATH, TRANCHE, functionalFailures, uxFailures);
    }
  });
});
