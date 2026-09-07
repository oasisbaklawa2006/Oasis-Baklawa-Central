#!/usr/bin/env node
/**
 * Record deploy BLOCKED for current-main rebaseline when no trusted Vercel URL exists
 * for the required SHA. Does not substitute prior e2f123b0 or ace340fe deploys.
 */
import fs from "node:fs";
import path from "node:path";
import { CREDENTIAL_PREFIX_UNBLOCK_UAT_IDS } from "./credential-prefix-aliases.mjs";

const ROOT = path.resolve(import.meta.dirname, "../..");
const REQUIRED_SHA =
  process.env.UAT_TARGET_SHA?.trim() || "15c59a3f54c92f2b289bd150005bcd7114b51a93";
const PRIOR_EVIDENCE_SHA = "e2f123b0fe257b8a1f39ec40d5f544fff1ebe313";
const RUN_ID = process.env.GITHUB_RUN_ID || "watchdog-local";
const RUN_TRANCHE = process.env.RUN_TRANCHE || "credential-prefix-unblock";
const REASON =
  process.env.UAT_DEPLOY_BLOCK_REASON?.trim() ||
  `No successful Vercel deployment for current main ${REQUIRED_SHA}; lane-7 requires exact SHA — no ace340fe/e2f123b0/d55306b3 substitution.`;

const PUBLIC_RUNNABLE = new Set(["UAT-0001", "UAT-0004", "UAT-0005", "UAT-0008", "UAT-0009"]);

function writeJson(relativePath, data) {
  const filePath = path.join(ROOT, relativePath);
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, `${JSON.stringify(data, null, 2)}\n`, "utf8");
}

function appendJsonl(relativePath, row) {
  const filePath = path.join(ROOT, relativePath);
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.appendFileSync(filePath, `${JSON.stringify(row)}\n`, "utf8");
}

const now = new Date().toISOString();
const census = JSON.parse(
  fs.readFileSync(path.join(ROOT, "docs/uat-crawl/UAT_ROUTE_CENSUS.json"), "utf8"),
);

let verifiedBlocked = 28;
let credsAvailable = 18;
const summaryPath = path.join(ROOT, "docs/uat-crawl/UAT_VERIFIED_BLOCKERS_SUMMARY.json");
if (fs.existsSync(summaryPath)) {
  const summary = JSON.parse(fs.readFileSync(summaryPath, "utf8"));
  verifiedBlocked = summary.verifiedBlocked ?? verifiedBlocked;
  credsAvailable = summary.credentialsAvailableAwaitingEvidence ?? credsAvailable;
}

const payload = {
  generatedAt: now,
  runId: RUN_ID,
  runTranche: RUN_TRANCHE,
  lane: "seventh — credential-prefix-unblock @ exact current main",
  requiredSha: REQUIRED_SHA,
  priorEvidenceSha: PRIOR_EVIDENCE_SHA,
  latestProductionDeploySha: "d55306b353359ff1cc746dd9c166a72e4a5eb320",
  deployStatus: "BLOCKED",
  reason: REASON,
  vercelCommitStatus: "failure — Deployment rate limited (api-deployments-free-per-day)",
  vercelRateLimitSuspected: true,
  censusTotal: census.entries.length,
  verifiedCredentialBlocked: verifiedBlocked,
  credentialsAvailableAwaitingDeploy: credsAvailable,
  credentialPrefixUnblockTargets: CREDENTIAL_PREFIX_UNBLOCK_UAT_IDS,
  credentialPrefixUnblockCount: CREDENTIAL_PREFIX_UNBLOCK_UAT_IDS.length,
  recertifiedAtRequiredSha: 0,
  publicRunnableIds: [...PUBLIC_RUNNABLE],
  policy:
    "Prior e2f123b0 + BLOCKED archive preserved append-only — NOT recertified as 15c59a3f without trusted deploy.",
  stopCondition: "DEPLOY_BLOCKED @ 15c59a3f — execute credential-prefix-unblock then chronological crawl when exact SHA deploy lands.",
  nextAction:
    "Vercel deploy for 15c59a3f (or TEST_PREVIEW_URL at exact SHA) → re-run credential-prefix-unblock then watchdog-continue.",
};

writeJson("docs/uat-crawl/UAT_REBASELINE_DEPLOY_BLOCKED.json", payload);
appendJsonl("docs/uat-crawl/UAT_REBASELINE_DEPLOY_BLOCKED_ARCHIVE.jsonl", payload);

writeJson("docs/uat-crawl/UAT_DEPLOY_PROVENANCE.json", {
  generatedAt: now,
  runId: RUN_ID,
  runTranche: RUN_TRANCHE,
  requiredSha: REQUIRED_SHA,
  priorEvidenceSha: PRIOR_EVIDENCE_SHA,
  resolvedSha: null,
  resolvedUrl: null,
  status: "DEPLOY_BLOCKED",
  reason: REASON,
  policy: "Do not substitute e2f123b0, ace340fe, or d55306b3 production as 15c59a3f lane-7 evidence.",
});

console.log(`Recorded lane-7 deploy BLOCKED for ${REQUIRED_SHA} (run ${RUN_ID}).`);
