#!/usr/bin/env node
/**
 * Archive AI-UAT evidence into docs/uat-crawl/ (append-only manifest rows).
 * Always writes a current-run summary — never leaves a prior PASS as current truth.
 */
import fs from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";
import {
  CENTRAL_PUBLIC_PRODUCTION_ALIAS,
  buildDeployProvenanceLabel,
} from "./crawl-target-policy.mjs";

const ROOT = path.resolve(import.meta.dirname, "../..");
const requireJson = createRequire(import.meta.url);
const RUN_ID = process.env.GITHUB_RUN_ID || "local";
const RUN_ATTEMPT = process.env.GITHUB_RUN_ATTEMPT || "1";
const RUN_TRANCHE = process.env.RUN_TRANCHE || "ai-uat";
const TARGET_SHA = process.env.UAT_TARGET_SHA?.trim() || "";
const DEPLOYMENT_SHA = process.env.UAT_RESOLVED_DEPLOY_SHA?.trim() || TARGET_SHA;
const BASE_URL =
  process.env.TEST_PREVIEW_URL?.trim() ||
  process.env.UAT_CRAWL_BASE_URL?.trim() ||
  CENTRAL_PUBLIC_PRODUCTION_ALIAS;
const AI_UAT_EXIT_CODE = Number.parseInt(process.env.AI_UAT_EXIT_CODE || "0", 10);
const EXPECTED_UAT_IDS = [
  "UAT-001",
  "UAT-002",
  "UAT-003",
  "UAT-004",
  "UAT-005",
  "UAT-006",
  "UAT-007",
  "UAT-008",
  "UAT-009",
  "UAT-010",
];

const srcJsonl = path.join(ROOT, "test-results/ai-uat-evidence.jsonl");
const destJsonl = path.join(ROOT, "docs/uat-crawl/UAT_MANIFEST_AI_UAT.jsonl");
const destReport = path.join(ROOT, "docs/uat-crawl/UAT_AI_UAT_REPORT.md");
const destSummary = path.join(ROOT, "docs/uat-crawl/UAT_AI_UAT_SUMMARY.json");
const archiveSummary = path.join(ROOT, "docs/uat-crawl/UAT_AI_UAT_SUMMARY_ARCHIVE.jsonl");
const srcReport = path.join(ROOT, "test-results/APPVERSE_AI_UAT_REPORT.md");

function appendJsonl(filePath, row) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.appendFileSync(filePath, `${JSON.stringify(row)}\n`, "utf8");
}

const counts = { PASS: 0, FAIL: 0, BLOCKED: 0, NOT_EXECUTED: 0 };
const uatIds = [];
const currentRunRows = [];
let priorRunArchived = false;

try {
  const prior = requireJson("../../docs/uat-crawl/UAT_AI_UAT_SUMMARY.json");
  if (prior.runId && prior.runId !== RUN_ID) {
    appendJsonl(archiveSummary, { ...prior, archivedAt: new Date().toISOString(), archiveReason: "prior-run" });
    priorRunArchived = true;
  }
} catch {
  /* no prior summary or malformed — safe on first run */
}

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
    else counts.BLOCKED += 1;
    uatIds.push(row.uat_id);
    const manifestRow = {
      uatId: row.uat_id,
      tranche: "ai-uat-tranche-1",
      runId: RUN_ID,
      runAttempt: RUN_ATTEMPT,
      runTranche: RUN_TRANCHE,
      targetMainSha: TARGET_SHA,
      deploymentSha: DEPLOYMENT_SHA,
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
      deployProvenance: buildDeployProvenanceLabel(TARGET_SHA),
    };
    currentRunRows.push(manifestRow);
    appendJsonl(destJsonl, manifestRow);
  }
}

const executedIds = new Set(uatIds);
for (const expectedId of EXPECTED_UAT_IDS) {
  if (!executedIds.has(expectedId)) {
    counts.NOT_EXECUTED += 1;
    const notExecutedRow = {
      uatId: expectedId,
      tranche: "ai-uat-tranche-1",
      runId: RUN_ID,
      runAttempt: RUN_ATTEMPT,
      runTranche: RUN_TRANCHE,
      targetMainSha: TARGET_SHA,
      deploymentSha: DEPLOYMENT_SHA,
      crawlBaseUrl: BASE_URL,
      timestamp: new Date().toISOString(),
      visualStatus: "NOT_EXECUTED",
      functionStatus: "NOT_EXECUTED",
      uxStatus: "NOT_EXECUTED",
      deployProvenance: buildDeployProvenanceLabel(TARGET_SHA),
      notes: AI_UAT_EXIT_CODE !== 0 ? "Suite failed before this case executed" : "Not executed in current run",
    };
    currentRunRows.push(notExecutedRow);
    appendJsonl(destJsonl, notExecutedRow);
  }
}

if (AI_UAT_EXIT_CODE !== 0 && counts.PASS === 0 && counts.FAIL === 0 && counts.BLOCKED === 0) {
  counts.NOT_EXECUTED = EXPECTED_UAT_IDS.length;
}

if (fs.existsSync(srcReport)) {
  fs.mkdirSync(path.dirname(destReport), { recursive: true });
  fs.copyFileSync(srcReport, destReport);
} else if (AI_UAT_EXIT_CODE !== 0) {
  fs.mkdirSync(path.dirname(destReport), { recursive: true });
  fs.writeFileSync(
    destReport,
    `# AI-UAT Report — run ${RUN_ID}\n\n**Status:** FAIL / NOT_EXECUTED\n\nSuite exited with code ${AI_UAT_EXIT_CODE} before a complete current-run report was produced.\n`,
    "utf8",
  );
}

const summary = {
  generatedAt: new Date().toISOString(),
  runId: RUN_ID,
  runAttempt: RUN_ATTEMPT,
  runTranche: RUN_TRANCHE,
  targetSha: TARGET_SHA,
  deploymentSha: DEPLOYMENT_SHA,
  crawlBaseUrl: BASE_URL,
  deployStatus: BASE_URL ? "RESOLVED" : "BLOCKED",
  suiteExitCode: AI_UAT_EXIT_CODE,
  counts,
  uatIds: EXPECTED_UAT_IDS.map((id) => ({
    uatId: id,
    status: executedIds.has(id)
      ? currentRunRows.find((r) => r.uatId === id)?.visualStatus || "UNKNOWN"
      : "NOT_EXECUTED",
  })),
  priorRunArchived,
  policy: "Current-run summary only — prior PASS rows archived separately; never substitute stale PASS as current truth.",
};

fs.mkdirSync(path.dirname(destSummary), { recursive: true });
fs.writeFileSync(
  new URL("../../docs/uat-crawl/UAT_AI_UAT_SUMMARY.json", import.meta.url),
  `${JSON.stringify(summary, null, 2)}\n`,
  "utf8",
);

console.log(
  `Archived AI-UAT evidence run ${RUN_ID}: PASS ${counts.PASS} FAIL ${counts.FAIL} BLOCKED ${counts.BLOCKED} NOT_EXECUTED ${counts.NOT_EXECUTED}`,
);
