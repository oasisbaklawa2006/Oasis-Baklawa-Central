#!/usr/bin/env node
/**
 * Record ace340fe continuation-crawl deploy provenance when current main (e2f123b0)
 * has no trusted Vercel URL. Explicitly NOT current-main certification.
 */
import fs from "node:fs";
import path from "node:path";

const ROOT = path.resolve(import.meta.dirname, "../..");
const CURRENT_MAIN_HOLD_SHA =
  process.env.UAT_TARGET_SHA?.trim() || "e2f123b0fe257b8a1f39ec40d5f544fff1ebe313";
const RESOLVED_SHA =
  process.env.UAT_RESOLVED_DEPLOY_SHA?.trim() || "ace340fe1d122a4cce5d7bb61cd237ed7ba1c894";
const RESOLVED_URL =
  process.env.TEST_PREVIEW_URL?.trim() ||
  process.env.UAT_CRAWL_BASE_URL?.trim() ||
  "https://oasis-baklawa-central-6zo99hosg-oasisbaklawa2006-6222s-projects.vercel.app";
const RUN_ID = process.env.GITHUB_RUN_ID || "local";
const RUN_TRANCHE = process.env.RUN_TRANCHE || "all";
const LABEL =
  process.env.UAT_DEPLOY_PROVENANCE_LABEL?.trim() ||
  "ace340fe continuation crawl — NOT current-main e2f123b0 certification.";

const now = new Date().toISOString();
const outPath = path.join(ROOT, "docs/uat-crawl/UAT_DEPLOY_PROVENANCE.json");

const payload = {
  generatedAt: now,
  runId: RUN_ID,
  runTranche: RUN_TRANCHE,
  requiredSha: CURRENT_MAIN_HOLD_SHA,
  requiredShaStatus: "HELD — no trusted Vercel deploy (rate limit suspected)",
  resolvedSha: RESOLVED_SHA,
  resolvedUrl: RESOLVED_URL,
  status: "CONTINUATION_FALLBACK",
  continuationFallback: true,
  label: LABEL,
  policy: "ace340fe used for chronological continuation crawl only — NOT post-#490 current-main rebaseline.",
  fail493EvidencePreserved: {
    originalFailRun: "34015742110",
    originalFailSha: "8f042fa",
    repairPassRun: "34016393457",
    repairPassSha: "9715c20d",
    repairPr: "497",
    note: "9715c20d preview PASS preserved separately — current-main cert requires post-merge-497-main tranche on e2f123b0 deploy",
  },
  buyerMobileBlocker: "TEST_BUYER_EMAIL, TEST_BUYER_PASSWORD — no fabricated evidence",
};

fs.mkdirSync(path.dirname(outPath), { recursive: true });
fs.writeFileSync(outPath, `${JSON.stringify(payload, null, 2)}\n`, "utf8");
console.log(`Recorded continuation provenance: ${RESOLVED_SHA} @ ${RESOLVED_URL}`);
