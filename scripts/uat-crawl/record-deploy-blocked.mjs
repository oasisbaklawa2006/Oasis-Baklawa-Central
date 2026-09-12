#!/usr/bin/env node
/**
 * Record BLOCKED UAT rows when current-main deploy (67b3d1cc) has no trusted Vercel URL.
 * Does not substitute legacy ace340fe deploy as current evidence.
 */
import fs from "node:fs";
import path from "node:path";

const ROOT = path.resolve(import.meta.dirname, "../..");
const TARGET_SHA = process.env.UAT_TARGET_SHA?.trim() || "67b3d1cc0baf7d494cb7a00ce55a74f16b6af43b";
const RUN_ID = process.env.GITHUB_RUN_ID || "local";
const REASON =
  process.env.UAT_DEPLOY_BLOCK_REASON?.trim() ||
  "No successful Vercel deployment for current main (#490 @ 67b3d1cc); ace340fe not substituted as post-#490 evidence.";

const AI_UAT_IDS = [
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

function appendJsonl(filePath, row) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.appendFileSync(filePath, `${JSON.stringify(row)}\n`, "utf8");
}

function writeJson(filePath, data) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, `${JSON.stringify(data, null, 2)}\n`, "utf8");
}

const now = new Date().toISOString();
const manifestAi = path.join(ROOT, "docs/uat-crawl/UAT_MANIFEST_AI_UAT.jsonl");

for (const uatId of AI_UAT_IDS) {
  appendJsonl(manifestAi, {
    uatId,
    tranche: "ai-uat-tranche-1",
    runId: RUN_ID,
    targetSha: TARGET_SHA,
    crawlBaseUrl: "",
    timestamp: now,
    visualStatus: "BLOCKED",
    functionStatus: "BLOCKED",
    uxStatus: "BLOCKED",
    deployProvenance: REASON,
    notes: "AI-UAT deploy BLOCKED — no trusted current-main URL.",
  });
}

writeJson(path.join(ROOT, "docs/uat-crawl/UAT_AI_UAT_SUMMARY.json"), {
  generatedAt: now,
  runId: RUN_ID,
  targetSha: TARGET_SHA,
  crawlBaseUrl: "",
  deployStatus: "BLOCKED",
  deployProvenance: REASON,
  counts: { PASS: 0, FAIL: 0, BLOCKED: AI_UAT_IDS.length },
  uatIds: AI_UAT_IDS,
});

writeJson(path.join(ROOT, "docs/uat-crawl/UAT_DEPLOY_PROVENANCE.json"), {
  generatedAt: now,
  runId: RUN_ID,
  requiredSha: TARGET_SHA,
  resolvedSha: null,
  resolvedUrl: null,
  status: "BLOCKED",
  reason: REASON,
  legacy483Sha: "ace340fe1d122a4cce5d7bb61cd237ed7ba1c894",
  policy: "Do not substitute ace340fe as post-#490 current evidence.",
});

console.log(`Recorded deploy BLOCKED for ${AI_UAT_IDS.length} AI-UAT IDs (target ${TARGET_SHA}).`);
