#!/usr/bin/env node
/** Record current-main rebaseline disposition @ a619a7a2 (#558) from manifests + blockers. */
import fs from "node:fs";
import path from "node:path";

const ROOT = path.resolve(import.meta.dirname, "../..");
const CURRENT_MAIN_SHA =
  process.env.UAT_TARGET_SHA?.trim() || "a619a7a2ef01ee889d32fffebb5ff13fe3181252";
const PRIOR_HOLD_SHA = "6c7de2a69cec960f709a66fb85d25049dfcc2ae0";
const RUN_ID = process.env.GITHUB_RUN_ID || "rebaseline-local";

function loadJsonl(relativePath) {
  const filePath = path.join(ROOT, relativePath);
  if (!fs.existsSync(filePath)) return [];
  return fs
    .readFileSync(filePath, "utf8")
    .trim()
    .split("\n")
    .filter(Boolean)
    .map((line) => JSON.parse(line));
}

function authCompleteIds() {
  const ids = new Set();
  for (const row of loadJsonl("docs/uat-crawl/UAT_MANIFEST_AUTH.jsonl")) {
    if (
      row.baselineSha === CURRENT_MAIN_SHA &&
      row.authenticated &&
      row.functionStatus === "OBSERVED" &&
      row.uxEvidence?.s0 &&
      row.uxEvidence?.s3
    ) {
      ids.add(row.uatId);
    }
  }
  for (const row of loadJsonl("docs/uat-crawl/UAT_MANIFEST_BUYER_MOBILE.jsonl")) {
    if (
      row.baselineSha === CURRENT_MAIN_SHA &&
      row.authenticated &&
      row.functionStatus === "OBSERVED" &&
      row.uxEvidence?.s0 &&
      row.uxEvidence?.s3
    ) {
      ids.add(row.uatId);
    }
  }
  for (const row of loadJsonl("docs/uat-crawl/UAT_MANIFEST_POST_FIX_483.jsonl")) {
    if (
      row.postFixDeploySha === CURRENT_MAIN_SHA &&
      row.functionStatus === "OBSERVED" &&
      row.uxEvidence?.s0 &&
      row.uxEvidence?.s3
    ) {
      ids.add(row.uatId);
    }
  }
  return ids;
}

const census = JSON.parse(
  fs.readFileSync(path.join(ROOT, "docs/uat-crawl/UAT_ROUTE_CENSUS.json"), "utf8"),
).entries;
const authComplete = authCompleteIds();
const blockers = loadJsonl("docs/uat-crawl/UAT_VERIFIED_BLOCKERS.jsonl");
const blockersById = new Map(blockers.map((b) => [b.uatId, b]));
const publicIds = new Set(["UAT-0001", "UAT-0004", "UAT-0005", "UAT-0008", "UAT-0009"]);
const publicAtMain = loadJsonl("docs/uat-crawl/UAT_MANIFEST_PUBLIC_CONTINUATION.jsonl").filter(
  (r) => r.baselineSha === CURRENT_MAIN_SHA && r.uxEvidence?.s0,
);

const rows = census.map((entry) => {
  if (authComplete.has(entry.uatId)) {
    return { uatId: entry.uatId, disposition: "PASS", buildSha: CURRENT_MAIN_SHA };
  }
  const blocker = blockersById.get(entry.uatId);
  if (blocker) {
    return {
      uatId: entry.uatId,
      disposition: "BLOCKED",
      buildSha: CURRENT_MAIN_SHA,
      missingSecretNames: blocker.missingSecretNames,
      failId: blocker.failId,
    };
  }
  if (publicIds.has(entry.uatId) && publicAtMain.some((p) => p.uatId === entry.uatId)) {
    return { uatId: entry.uatId, disposition: "PUBLIC_S0", buildSha: CURRENT_MAIN_SHA };
  }
  return { uatId: entry.uatId, disposition: "NOT-TESTED", buildSha: CURRENT_MAIN_SHA };
});

const payload = {
  generatedAt: new Date().toISOString(),
  runId: RUN_ID,
  currentMainSha: CURRENT_MAIN_SHA,
  priorHoldSha: PRIOR_HOLD_SHA,
  deployProvenance:
    "Current-main authority @ a619a7a2 (#558) — prior 6c7de2a/15c59a3f/e2f123b0 evidence preserved append-only.",
  policy: "No PR preview substitution. No screenshot = NOT-TESTED; no action/result = function NOT-TESTED.",
  counts: {
    censusTotal: rows.length,
    passAuthS0S3: authComplete.size,
    blocked: rows.filter((r) => r.disposition === "BLOCKED").length,
    publicS0: rows.filter((r) => r.disposition === "PUBLIC_S0").length,
    notTested: rows.filter((r) => r.disposition === "NOT-TESTED").length,
  },
  rows,
};

const outPath = path.join(ROOT, "docs/uat-crawl/UAT_REBASELINE_CURRENT_MAIN.json");
fs.writeFileSync(outPath, `${JSON.stringify(payload, null, 2)}\n`);
console.log(
  `Recorded rebaseline @ ${CURRENT_MAIN_SHA}: ${authComplete.size} PASS, ${payload.counts.blocked} BLOCKED, ${payload.counts.notTested} NOT-TESTED.`,
);
