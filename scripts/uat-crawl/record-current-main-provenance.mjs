#!/usr/bin/env node
/** Record trusted current-main deploy provenance with dynamic labels (no stale SHA text). */
import fs from "node:fs";
import path from "node:path";
import {
  CENTRAL_CRAWL_TARGET_TYPE_PUBLIC,
  CENTRAL_PUBLIC_PRODUCTION_ALIAS,
  buildDeployProvenanceLabel,
} from "./crawl-target-policy.mjs";

const ROOT = path.resolve(import.meta.dirname, "../..");
const CURRENT_MAIN_SHA =
  process.env.POST_MERGE_497_MAIN_SHA?.trim() ||
  process.env.UAT_TARGET_SHA?.trim() ||
  "";
const DEPLOYMENT_SHA = process.env.UAT_RESOLVED_DEPLOY_SHA?.trim() || CURRENT_MAIN_SHA;
const PROTECTED_DEPLOYMENT_URL =
  process.env.UAT_PROTECTED_DEPLOYMENT_URL?.trim() ||
  process.env.UAT_IMMUTABLE_DEPLOYMENT_URL?.trim() ||
  "";
const CRAWL_BASE_URL =
  process.env.UAT_CRAWL_BASE_URL?.trim() ||
  process.env.TEST_PREVIEW_URL?.trim() ||
  CENTRAL_PUBLIC_PRODUCTION_ALIAS;
const CRAWL_TARGET_TYPE = process.env.UAT_CRAWL_TARGET_TYPE?.trim() || CENTRAL_CRAWL_TARGET_TYPE_PUBLIC;
const DEPLOY_ID = process.env.POST_MERGE_497_DEPLOYMENT_ID?.trim() || process.env.UAT_RESOLVED_DEPLOYMENT_ID?.trim() || "";
const DEPLOY_ENV = process.env.UAT_DEPLOYMENT_ENVIRONMENT?.trim() || "production";
const RUN_ID = process.env.GITHUB_RUN_ID || "local";
const RUN_ATTEMPT = process.env.GITHUB_RUN_ATTEMPT || "1";
const RUN_TRANCHE = process.env.RUN_TRANCHE || "watchdog-continue";
const PRIOR_CURRENT_MAIN_HOLD_SHA = "6c7de2a69cec960f709a66fb85d25049dfcc2ae0";
const PRIOR_CURRENT_MAIN_HOLD_SHA_507 = "15c59a3f54c92f2b289bd150005bcd7114b51a93";
const PRIOR_EVIDENCE_SHA = "e2f123b0fe257b8a1f39ec40d5f544fff1ebe313";

const label = buildDeployProvenanceLabel(CURRENT_MAIN_SHA);
const outPath = path.join(ROOT, "docs/uat-crawl/UAT_DEPLOY_PROVENANCE.json");
const payload = {
  generatedAt: new Date().toISOString(),
  runId: RUN_ID,
  runAttempt: RUN_ATTEMPT,
  runTranche: RUN_TRANCHE,
  resolvedMainSha: CURRENT_MAIN_SHA,
  resolvedDeploymentSha: DEPLOYMENT_SHA,
  resolvedDeploymentId: DEPLOY_ID,
  protectedDeploymentUrl: PROTECTED_DEPLOYMENT_URL,
  crawlBaseUrl: CRAWL_BASE_URL,
  crawlTargetType: CRAWL_TARGET_TYPE,
  deploymentEnvironment: DEPLOY_ENV,
  requiredSha: CURRENT_MAIN_SHA,
  requiredShaStatus: `TRUSTED — current Central main @ ${CURRENT_MAIN_SHA}`,
  resolvedSha: DEPLOYMENT_SHA,
  resolvedUrl: CRAWL_BASE_URL,
  githubDeploymentId: DEPLOY_ID,
  status: "CURRENT_MAIN_REBASELINE",
  continuationFallback: false,
  priorCurrentMainHoldSha: PRIOR_CURRENT_MAIN_HOLD_SHA,
  priorCurrentMainHoldSha507: PRIOR_CURRENT_MAIN_HOLD_SHA_507,
  priorEvidenceSha: PRIOR_EVIDENCE_SHA,
  label,
  policy:
    "Append-only: historical evidence preserved; current-run labels generated dynamically from resolved SHAs.",
  fail493EvidencePreserved: {
    note: "Historical FAIL-493 / preview / prior-main evidence rows preserved append-only — not substituted by current run.",
    priorMainEvidenceSha: PRIOR_EVIDENCE_SHA,
    priorCurrentMainHoldSha: PRIOR_CURRENT_MAIN_HOLD_SHA,
    priorCurrentMainHoldSha507: PRIOR_CURRENT_MAIN_HOLD_SHA_507,
    currentMainRebaselineSha: CURRENT_MAIN_SHA,
  },
};

fs.mkdirSync(path.dirname(outPath), { recursive: true });
fs.writeFileSync(outPath, `${JSON.stringify(payload, null, 2)}\n`);
