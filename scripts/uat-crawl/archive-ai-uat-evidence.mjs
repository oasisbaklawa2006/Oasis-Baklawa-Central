#!/usr/bin/env node
/**
 * Archive AI-UAT evidence into docs/uat-crawl/ (append-only manifest rows).
 */
import fs from "node:fs";
import path from "node:path";

const ROOT = path.resolve(import.meta.dirname, "../..");
const RUN_ID = process.env.GITHUB_RUN_ID || "local";
const TARGET_SHA = process.env.UAT_TARGET_SHA?.trim() || "67b3d1cc0baf7d494cb7a00ce55a74f16b6af43b";
const BASE_URL = process.env.TEST_PREVIEW_URL?.trim() || "";
const srcJsonl = path.join(ROOT, "test-results/ai-uat-evidence.jsonl");
const destJsonl = path.join(ROOT, "docs/uat-crawl/UAT_MANIFEST_AI_UAT.jsonl");
const destReport = path.join(ROOT, "docs/uat-crawl/UAT_AI_UAT_REPORT.md");
const destSummary = path.join(ROOT, "docs/uat-crawl/UAT_AI_UAT_SUMMARY.json");
const srcReport = path.join(ROOT, "test-results/APPVERSE_AI_UAT_REPORT.md");

function appendJsonl(filePath, row) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.appendFileSync(filePath, `${JSON.stringify(row)}\n`, "utf8");
}

const counts = { PASS: 0, FAIL: 0, BLOCKED: 0 };
const uatIds = [];

if (fs.existsSync(srcJsonl)) {
  for (const line of fs.readFileSync(srcJsonl, "utf8").split(/\r?\n/).filter(Boolean)) {
    let row;
    try {
      row = JSON.parse(line);
    } catch {
      continue;
    }
    const status = row.status || "BLOCKED";
    if (status in counts) counts[status] += 1;
    uatIds.push(row.uat_id);
    appendJsonl(destJsonl, {
      uatId: row.uat_id,
      tranche: "ai-uat-tranche-1",
      runId: RUN_ID,
      targetSha: TARGET_SHA,
      crawlBaseUrl: BASE_URL,
      timestamp: row.generated_at || new Date().toISOString(),
      visualStatus: status,
      functionStatus: status,
      uxStatus: status,
      role: row.role,
      expected: row.expected,
      actual: row.actual,
      finalUrl: row.final_url,
      severity: row.severity,
      screenshots: row.screenshots?.length || 0,
      deployProvenance: `current-main ${TARGET_SHA}`,
    });
  }
}

if (fs.existsSync(srcReport)) {
  fs.mkdirSync(path.dirname(destReport), { recursive: true });
  fs.copyFileSync(srcReport, destReport);
}

fs.mkdirSync(path.dirname(destSummary), { recursive: true });
fs.writeFileSync(
  destSummary,
  `${JSON.stringify(
    {
      generatedAt: new Date().toISOString(),
      runId: RUN_ID,
      targetSha: TARGET_SHA,
      crawlBaseUrl: BASE_URL,
      deployStatus: BASE_URL ? "RESOLVED" : "BLOCKED",
      counts,
      uatIds,
    },
    null,
    2,
  )}\n`,
  "utf8",
);

console.log(`Archived AI-UAT evidence: PASS ${counts.PASS} FAIL ${counts.FAIL} BLOCKED ${counts.BLOCKED}`);
