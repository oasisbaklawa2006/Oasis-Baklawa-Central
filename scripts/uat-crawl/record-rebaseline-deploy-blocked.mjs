#!/usr/bin/env node
/**
 * Record deploy BLOCKED for current-main rebaseline when no trusted Vercel URL exists
 * for the required SHA. Does not substitute prior holds or stale previews.
 */
import fs from "node:fs";
import path from "node:path";
import { CREDENTIAL_PREFIX_UNBLOCK_UAT_IDS } from "./credential-prefix-aliases.mjs";

const ROOT = path.resolve(import.meta.dirname, "../..");
const REQUIRED_SHA =
  process.env.UAT_TARGET_SHA?.trim() || "6c7de2a69cec960f709a66fb85d25049dfcc2ae0";
const PRIOR_CURRENT_MAIN_HOLD_SHA = "15c59a3f54c92f2b289bd150005bcd7114b51a93";
const PRIOR_EVIDENCE_SHA = "e2f123b0fe257b8a1f39ec40d5f544fff1ebe313";
const DEPLOY_PROVENANCE_LABEL =
  "Current-main authority @ 6c7de2a (#556) — prior 15c59a3f/e2f123b0 evidence preserved append-only.";
const RUN_ID = process.env.GITHUB_RUN_ID || "watchdog-local";
const RUN_TRANCHE = process.env.RUN_TRANCHE || "credential-prefix-unblock";
const REASON =
  process.env.UAT_DEPLOY_BLOCK_REASON?.trim() ||
  `No successful Vercel deployment for current main ${REQUIRED_SHA}; lane-7 requires exact SHA — no 15c59a3f/d55306b3/c7f4ddf2/ace340fe substitution.`;

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

const credentialBlockedIds = new Set(
  loadJsonl("docs/uat-crawl/UAT_VERIFIED_BLOCKERS.jsonl").map((row) => row.uatId),
);

const deployNotTestedRows = [];
for (const entry of census.entries) {
  if (credentialBlockedIds.has(entry.uatId)) continue;
  deployNotTestedRows.push({
    uatId: entry.uatId,
    app: entry.app,
    route: entry.route,
    state: entry.state,
    role: entry.persona,
    device: entry.device,
    requiredSha: REQUIRED_SHA,
    priorCurrentMainHoldSha: PRIOR_CURRENT_MAIN_HOLD_SHA,
    priorEvidenceSha: PRIOR_EVIDENCE_SHA,
    runId: RUN_ID,
    timestamp: now,
    visualStatus: "NOT-TESTED",
    functionStatus: "NOT-TESTED",
    uxStatus: "NOT-TESTED",
    disposition: "DEPLOY_BLOCKED",
    deployBlockReason: REASON,
    deployProvenance: DEPLOY_PROVENANCE_LABEL,
    notes: CREDENTIAL_PREFIX_UNBLOCK_UAT_IDS.includes(entry.uatId)
      ? "Credential-cleared Gate/RGS/3PGS — awaiting exact-SHA deploy for S0–S3 capture"
      : "Runnable at current main — awaiting exact-SHA deploy; prior evidence preserved append-only",
  });
}

const notTestedPath = "docs/uat-crawl/UAT_CURRENT_MAIN_NOT_TESTED.jsonl";
const notTestedArchivePath = "docs/uat-crawl/UAT_CURRENT_MAIN_NOT_TESTED_ARCHIVE.jsonl";
if (fs.existsSync(path.join(ROOT, notTestedPath))) {
  appendJsonl(notTestedArchivePath, {
    archivedAt: now,
    runId: RUN_ID,
    requiredSha: REQUIRED_SHA,
    priorCurrentMainHoldSha: PRIOR_CURRENT_MAIN_HOLD_SHA,
    rowCount: loadJsonl(notTestedPath).length,
    policy: "Append-only archive of superseded NOT-TESTED registry",
  });
}
fs.mkdirSync(path.dirname(path.join(ROOT, notTestedPath)), { recursive: true });
fs.writeFileSync(
  path.join(ROOT, notTestedPath),
  `${deployNotTestedRows.map((row) => JSON.stringify(row)).join("\n")}\n`,
  "utf8",
);

const payload = {
  generatedAt: now,
  runId: RUN_ID,
  runTranche: RUN_TRANCHE,
  lane: "seventh — credential-prefix-unblock @ exact current main",
  requiredSha: REQUIRED_SHA,
  priorCurrentMainHoldSha: PRIOR_CURRENT_MAIN_HOLD_SHA,
  priorEvidenceSha: PRIOR_EVIDENCE_SHA,
  latestProductionDeploySha: "c7f4ddf2",
  latestProductionDeployNote: "Not substitutable — does not match requiredSha 6c7de2a",
  deployStatus: "BLOCKED",
  reason: REASON,
  vercelCommitStatus: "failure — Deployment rate limited (api-deployments-free-per-day)",
  vercelRateLimitSuspected: true,
  censusTotal: census.entries.length,
  verifiedCredentialBlocked: verifiedBlocked,
  credentialsAvailableAwaitingDeploy: credsAvailable,
  deployNotTestedCount: deployNotTestedRows.length,
  credentialPrefixUnblockTargets: CREDENTIAL_PREFIX_UNBLOCK_UAT_IDS,
  credentialPrefixUnblockCount: CREDENTIAL_PREFIX_UNBLOCK_UAT_IDS.length,
  credentialPrefixUnblockDisposition: "NOT-TESTED / DEPLOY_BLOCKED",
  recertifiedAtRequiredSha: 0,
  publicRunnableIds: [...PUBLIC_RUNNABLE],
  policy:
    "Prior 15c59a3f + e2f123b0 + BLOCKED/NOT-TESTED archives preserved append-only — NOT recertified as 6c7de2a without trusted deploy.",
  stopCondition:
    "DEPLOY_BLOCKED @ 6c7de2a — execute credential-prefix-unblock then chronological crawl when exact SHA deploy lands.",
  nextAction:
    "Vercel deploy for 6c7de2a (or TEST_PREVIEW_URL at exact SHA) → re-run credential-prefix-unblock then watchdog-continue.",
};

writeJson("docs/uat-crawl/UAT_REBASELINE_DEPLOY_BLOCKED.json", payload);
appendJsonl("docs/uat-crawl/UAT_REBASELINE_DEPLOY_BLOCKED_ARCHIVE.jsonl", payload);

writeJson("docs/uat-crawl/UAT_DEPLOY_PROVENANCE.json", {
  generatedAt: now,
  runId: RUN_ID,
  runTranche: RUN_TRANCHE,
  requiredSha: REQUIRED_SHA,
  priorCurrentMainHoldSha: PRIOR_CURRENT_MAIN_HOLD_SHA,
  priorEvidenceSha: PRIOR_EVIDENCE_SHA,
  resolvedSha: null,
  resolvedUrl: null,
  status: "DEPLOY_BLOCKED",
  reason: REASON,
  deployProvenance: DEPLOY_PROVENANCE_LABEL,
  policy:
    "Do not substitute 15c59a3f, d55306b3, c7f4ddf2, ace340fe, or e2f123b0 as 6c7de2a lane-7 evidence.",
});

writeJson("docs/uat-crawl/UAT_VERIFIED_BLOCKERS_SUMMARY.json", {
  generatedAt: now,
  runId: RUN_ID,
  resolvedDeploySha: REQUIRED_SHA,
  currentMainHoldSha: REQUIRED_SHA,
  priorCurrentMainHoldSha: PRIOR_CURRENT_MAIN_HOLD_SHA,
  crawlBaseUrl: "",
  deployProvenance: DEPLOY_PROVENANCE_LABEL,
  authenticatedCompleteAtPriorShas: 81,
  publicContinuationCompleteAtPriorShas: 5,
  recertifiedAtRequiredSha: 0,
  deployNotTested: deployNotTestedRows.length,
  verifiedCredentialBlocked: verifiedBlocked,
  credentialsAvailableAwaitingDeploy: credsAvailable,
  counts: {
    censusTotal: census.entries.length,
    deployNotTested: deployNotTestedRows.length,
    credentialBlocked: verifiedBlocked,
    credsAvailableAwaitingDeploy: credsAvailable,
    recertifiedAt6c7de2a: 0,
  },
  policy:
    "No fabricated PASS. Historical manifests/screenshots at prior SHAs preserved append-only; current-main authority retargeted to 6c7de2a (#556).",
});

console.log(
  `Recorded lane-7 deploy BLOCKED for ${REQUIRED_SHA} (run ${RUN_ID}); ${deployNotTestedRows.length} NOT-TESTED rows.`,
);
