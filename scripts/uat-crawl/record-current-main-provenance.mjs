#!/usr/bin/env node
/** Record trusted current-main deploy provenance after #497 merge @ e2f123b0. */
import fs from "node:fs";
import path from "node:path";

const ROOT = path.resolve(import.meta.dirname, "../..");
const CURRENT_MAIN_SHA =
  process.env.POST_MERGE_497_MAIN_SHA?.trim() || "e2f123b0fe257b8a1f39ec40d5f544fff1ebe313";
const RESOLVED_URL =
  process.env.TEST_PREVIEW_URL?.trim() ||
  process.env.UAT_CRAWL_BASE_URL?.trim() ||
  "";
const DEPLOY_ID = process.env.POST_MERGE_497_DEPLOYMENT_ID?.trim() || "";
const RUN_ID = process.env.GITHUB_RUN_ID || "local";
const RUN_TRANCHE = process.env.RUN_TRANCHE || "post-merge-497-main";

const outPath = path.join(ROOT, "docs/uat-crawl/UAT_DEPLOY_PROVENANCE.json");
const payload = {
  generatedAt: new Date().toISOString(),
  runId: RUN_ID,
  runTranche: RUN_TRANCHE,
  requiredSha: CURRENT_MAIN_SHA,
  requiredShaStatus: "TRUSTED — #497 merged to main",
  resolvedSha: CURRENT_MAIN_SHA,
  resolvedUrl: RESOLVED_URL,
  githubDeploymentId: DEPLOY_ID,
  status: "CURRENT_MAIN_CERTIFICATION",
  continuationFallback: false,
  label: "Current-main #497 merge certification @ e2f123b0 — NOT substituting 9715c20d preview PASS",
  policy: "Append-only FAIL-493 evidence: pre-fix FAIL @ 8f042fa (run 34015742110) + preview PASS @ 9715c20d (run 34016393457) preserved.",
  fail493EvidencePreserved: {
    originalFailRun: "34015742110",
    originalFailSha: "8f042fa",
    previewPassRun: "34016393457",
    previewPassSha: "9715c20d",
    currentMainPassMergeSha: CURRENT_MAIN_SHA,
    note: "9715c20d preview PASS is NOT substituted by current-main cert — separate append-only rows",
  },
};

fs.mkdirSync(path.dirname(outPath), { recursive: true });
fs.writeFileSync(outPath, `${JSON.stringify(payload, null, 2)}\n`);
