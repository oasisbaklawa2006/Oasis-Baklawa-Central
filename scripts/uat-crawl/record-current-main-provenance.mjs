#!/usr/bin/env node
/** Record trusted current-main deploy provenance for rebaseline @ 15c59a3f (#507 POINT61). */
import fs from "node:fs";
import path from "node:path";

const ROOT = path.resolve(import.meta.dirname, "../..");
const CURRENT_MAIN_SHA =
  process.env.POST_MERGE_497_MAIN_SHA?.trim() ||
  process.env.UAT_TARGET_SHA?.trim() ||
  "15c59a3f54c92f2b289bd150005bcd7114b51a93";
const PRIOR_EVIDENCE_SHA = "e2f123b0fe257b8a1f39ec40d5f544fff1ebe313";
const RESOLVED_URL =
  process.env.TEST_PREVIEW_URL?.trim() ||
  process.env.UAT_CRAWL_BASE_URL?.trim() ||
  "";
const DEPLOY_ID = process.env.POST_MERGE_497_DEPLOYMENT_ID?.trim() || "";
const RUN_ID = process.env.GITHUB_RUN_ID || "local";
const RUN_TRANCHE = process.env.RUN_TRANCHE || "watchdog-continue";

const outPath = path.join(ROOT, "docs/uat-crawl/UAT_DEPLOY_PROVENANCE.json");
const payload = {
  generatedAt: new Date().toISOString(),
  runId: RUN_ID,
  runTranche: RUN_TRANCHE,
  requiredSha: CURRENT_MAIN_SHA,
  requiredShaStatus: "TRUSTED — current Central main (#507 POINT61 @ 15c59a3f)",
  resolvedSha: CURRENT_MAIN_SHA,
  resolvedUrl: RESOLVED_URL,
  githubDeploymentId: DEPLOY_ID,
  status: "CURRENT_MAIN_REBASELINE",
  continuationFallback: false,
  priorEvidenceSha: PRIOR_EVIDENCE_SHA,
  label:
    "Current-main rebaseline @ 15c59a3f (#507 POINT61) — prior e2f123b0 evidence preserved append-only",
  policy:
    "Append-only: e2f123b0 watchdog evidence (runs 34046709938, 34056691981) + FAIL-493 proof chain preserved; not substituted.",
  fail493EvidencePreserved: {
    originalFailRun: "34015742110",
    originalFailSha: "8f042fa",
    previewPassRun: "34016393457",
    previewPassSha: "9715c20d",
    priorMainEvidenceSha: PRIOR_EVIDENCE_SHA,
    currentMainRebaselineSha: CURRENT_MAIN_SHA,
    note: "9715c20d preview PASS and e2f123b0 current-main cert are NOT substituted by 15c59a3f rebaseline rows",
  },
};

fs.mkdirSync(path.dirname(outPath), { recursive: true });
fs.writeFileSync(outPath, `${JSON.stringify(payload, null, 2)}\n`);
