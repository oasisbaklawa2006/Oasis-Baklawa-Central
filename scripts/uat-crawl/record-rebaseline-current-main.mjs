#!/usr/bin/env node
/** Record current-main rebaseline disposition from manifests + blockers (dynamic SHA labels). */
import fs from "node:fs";
import path from "node:path";
import { buildDeployProvenanceLabel } from "./crawl-target-policy.mjs";
import { spawnSync } from "node:child_process";

const ROOT = path.resolve(import.meta.dirname, "../..");
const CURRENT_MAIN_SHA = process.env.UAT_TARGET_SHA?.trim() || "";
const RUN_ID = process.env.GITHUB_RUN_ID || "rebaseline-local";
const RUN_ATTEMPT = process.env.GITHUB_RUN_ATTEMPT || "1";
const RUN_TRANCHE = process.env.RUN_TRANCHE || "watchdog-continue";
const PRIOR_HOLD_SHA = "6c7de2a69cec960f709a66fb85d25049dfcc2ae0";

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

function authCompleteIds(censusIds) {
  const ids = new Set();
  const isCurrentRun = (row) => !row.runId || row.runId === RUN_ID;
  const matchesMain = (row) =>
    row.targetMainSha === CURRENT_MAIN_SHA ||
    row.baselineSha === CURRENT_MAIN_SHA ||
    row.postFixDeploySha === CURRENT_MAIN_SHA;

  for (const row of loadJsonl("docs/uat-crawl/UAT_MANIFEST_AUTH.jsonl")) {
    if (!censusIds.has(row.uatId)) continue;
    if (row.wallClassification === "DEPLOYMENT_PROTECTION") continue;
    if (
      isCurrentRun(row) &&
      matchesMain(row) &&
      row.authenticated &&
      row.functionStatus === "OBSERVED" &&
      row.uxEvidence?.s0 &&
      row.uxEvidence?.s3
    ) {
      ids.add(row.uatId);
    }
  }
  for (const row of loadJsonl("docs/uat-crawl/UAT_MANIFEST_BUYER_MOBILE.jsonl")) {
    if (!censusIds.has(row.uatId)) continue;
    if (
      isCurrentRun(row) &&
      matchesMain(row) &&
      row.authenticated &&
      row.functionStatus === "OBSERVED" &&
      row.uxEvidence?.s0 &&
      row.uxEvidence?.s3
    ) {
      ids.add(row.uatId);
    }
  }
  for (const row of loadJsonl("docs/uat-crawl/UAT_MANIFEST_POST_FIX_483.jsonl")) {
    if (!censusIds.has(row.uatId)) continue;
    if (row.wallClassification === "DEPLOYMENT_PROTECTION") continue;
    if (
      isCurrentRun(row) &&
      (row.postFixDeploySha === CURRENT_MAIN_SHA || row.targetMainSha === CURRENT_MAIN_SHA) &&
      row.functionStatus === "OBSERVED" &&
      row.uxEvidence?.s0 &&
      row.uxEvidence?.s3 &&
      row.screenshot?.includes("post-fix-483")
    ) {
      ids.add(row.uatId);
    }
  }
  return ids;
}

const census = JSON.parse(
  fs.readFileSync(path.join(ROOT, "docs/uat-crawl/UAT_ROUTE_CENSUS.json"), "utf8"),
).entries;
const censusIds = new Set(census.map((e) => e.uatId));
const authComplete = authCompleteIds(censusIds);
const blockers = loadJsonl("docs/uat-crawl/UAT_VERIFIED_BLOCKERS.jsonl").filter(
  (b) => !b.runId || b.runId === RUN_ID,
);
const blockersById = new Map(blockers.map((b) => [b.uatId, b]));
const publicIds = new Set(["UAT-0001", "UAT-0004", "UAT-0005", "UAT-0008", "UAT-0009"]);
const publicAtMain = loadJsonl("docs/uat-crawl/UAT_MANIFEST_PUBLIC_CONTINUATION.jsonl").filter(
  (r) =>
    (!r.runId || r.runId === RUN_ID) &&
    (r.targetMainSha === CURRENT_MAIN_SHA || r.baselineSha === CURRENT_MAIN_SHA) &&
    r.uxEvidence?.s0 &&
    r.wallClassification !== "DEPLOYMENT_PROTECTION",
);

const rows = census.map((entry) => {
  if (authComplete.has(entry.uatId)) {
    return { uatId: entry.uatId, disposition: "PASS", buildSha: CURRENT_MAIN_SHA, runId: RUN_ID };
  }
  const blocker = blockersById.get(entry.uatId);
  if (blocker) {
    return {
      uatId: entry.uatId,
      disposition: "BLOCKED",
      buildSha: CURRENT_MAIN_SHA,
      runId: RUN_ID,
      missingSecretNames: blocker.missingSecretNames,
      failId: blocker.failId,
    };
  }
  if (publicIds.has(entry.uatId) && publicAtMain.some((p) => p.uatId === entry.uatId)) {
    return { uatId: entry.uatId, disposition: "PUBLIC_S0", buildSha: CURRENT_MAIN_SHA, runId: RUN_ID };
  }
  return { uatId: entry.uatId, disposition: "NOT-TESTED", buildSha: CURRENT_MAIN_SHA, runId: RUN_ID };
});

const payload = {
  generatedAt: new Date().toISOString(),
  runId: RUN_ID,
  runAttempt: RUN_ATTEMPT,
  runTranche: RUN_TRANCHE,
  currentMainSha: CURRENT_MAIN_SHA,
  priorHoldSha: PRIOR_HOLD_SHA,
  deployProvenance: buildDeployProvenanceLabel(CURRENT_MAIN_SHA),
  policy: "No PR preview substitution. No screenshot = NOT-TESTED; deployment-protection wall = BLOCKED.",
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

spawnSync("node", ["scripts/uat-crawl/generate-physical-readiness-reconciliation.mjs"], {
  cwd: ROOT,
  stdio: "inherit",
  env: { ...process.env, UAT_LAST_GHA_RUN: RUN_ID },
});
