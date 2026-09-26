#!/usr/bin/env node
/**
 * Final certification verdict — collect-all then fail closed on material defects.
 * Must run after evidence collection steps (if: always()).
 */
import fs from "node:fs";
import path from "node:path";

const ROOT = path.resolve(import.meta.dirname, "../..");
const RUN_ID = process.env.GITHUB_RUN_ID || "local";
const RUN_TRANCHE = process.env.RUN_TRANCHE || "unknown";

function readJson(relativePath) {
  const filePath = path.join(ROOT, relativePath);
  if (!fs.existsSync(filePath)) return null;
  return JSON.parse(fs.readFileSync(filePath, "utf8"));
}

function readJsonl(relativePath) {
  const filePath = path.join(ROOT, relativePath);
  if (!fs.existsSync(filePath)) return [];
  return fs
    .readFileSync(filePath, "utf8")
    .trim()
    .split("\n")
    .filter(Boolean)
    .map((line) => JSON.parse(line));
}

const failures = [];
const warnings = [];

const outcomesPath = path.join(ROOT, "docs/uat-crawl/UAT_CRAWL_STEP_OUTCOMES.json");
const stepOutcomes = fs.existsSync(outcomesPath) ? readJson("docs/uat-crawl/UAT_CRAWL_STEP_OUTCOMES.json") : {};

if (process.env.UAT_DEPLOY_BLOCKED === "true") {
  failures.push("DEPLOY_BLOCKED: no trusted crawl target for current-main tranche");
}

for (const [step, outcome] of Object.entries(stepOutcomes)) {
  if (outcome === "failure" || outcome === "cancelled") {
    failures.push(`STEP_FAILED:${step}`);
  }
}
if (stepOutcomes.ai_uat === "failure") {
  failures.push("AI_UAT_SUITE_FAILED");
}
if (stepOutcomes.post_fix_483 === "failure") {
  failures.push("POST_FIX_483_SUITE_FAILED");
}

const blockersSummary = readJson("docs/uat-crawl/UAT_VERIFIED_BLOCKERS_SUMMARY.json");
if (blockersSummary && blockersSummary.denominatorReconciled === false) {
  failures.push("CENSUS_RECONCILIATION_FAILED");
}

const aiSummary = readJson("docs/uat-crawl/UAT_AI_UAT_SUMMARY.json");
if (aiSummary?.runId === RUN_ID) {
  if (stepOutcomes.ai_uat === "failure" && aiSummary.counts?.PASS > 0 && !aiSummary.priorRunArchived) {
    failures.push("AI_UAT_STALE_PASS: run failed but summary reports PASS from same run metadata conflict");
  }
  if (aiSummary.counts?.NOT_EXECUTED > 0 && stepOutcomes.ai_uat === "failure") {
    warnings.push("AI_UAT_NOT_EXECUTED_AFTER_FAILURE");
  }
} else if (stepOutcomes.ai_uat === "failure") {
  failures.push("AI_UAT_FAILED_WITHOUT_CURRENT_RUN_SUMMARY");
}

const ghaRun = readJson("docs/uat-crawl/UAT_GHA_RUN.json");
if (ghaRun?.deployBlocked === true) {
  failures.push("GHA_RUN_DEPLOY_BLOCKED");
}
if (ghaRun?.crawlTargetType && ghaRun.crawlTargetType !== "PUBLIC_PRODUCTION_ALIAS" && ghaRun.runTranche?.includes("watchdog")) {
  warnings.push(`CRAWL_TARGET_TYPE:${ghaRun.crawlTargetType}`);
}

const protectionRows = readJsonl("docs/uat-crawl/UAT_MANIFEST.jsonl")
  .concat(readJsonl("docs/uat-crawl/UAT_MANIFEST_AUTH.jsonl"))
  .filter((row) => row.blockClassification === "DEPLOYMENT_PROTECTION" || row.wallClassification === "DEPLOYMENT_PROTECTION");

if (protectionRows.length > 0) {
  failures.push(`DEPLOYMENT_PROTECTION:${protectionRows.map((r) => r.uatId).join(",")}`);
}

const rebaseline = readJson("docs/uat-crawl/UAT_REBASELINE_CURRENT_MAIN.json");
if (rebaseline?.runId === RUN_ID && rebaseline.deployProvenance?.includes("a619a7a2")) {
  failures.push("STALE_PROVENANCE_LABEL_IN_REBASELINE");
}

const provenance = readJson("docs/uat-crawl/UAT_DEPLOY_PROVENANCE.json");
if (provenance?.runId === RUN_ID && provenance.requiredShaStatus?.includes("a619a7a2")) {
  failures.push("STALE_PROVENANCE_LABEL_IN_DEPLOY_PROVENANCE");
}

const verdict = {
  generatedAt: new Date().toISOString(),
  runId: RUN_ID,
  runTranche: RUN_TRANCHE,
  passed: failures.length === 0,
  failures,
  warnings,
  stepOutcomes,
};

const outPath = path.join(ROOT, "docs/uat-crawl/UAT_CRAWL_CERTIFICATION_VERDICT.json");
fs.mkdirSync(path.dirname(outPath), { recursive: true });
fs.writeFileSync(outPath, `${JSON.stringify(verdict, null, 2)}\n`);

if (failures.length > 0) {
  for (const failure of failures) {
    console.error(`::error::UAT certification verdict FAILED — ${failure}`);
  }
  process.exitCode = 1;
} else {
  console.log(`UAT certification verdict PASSED (warnings=${warnings.length}).`);
}
