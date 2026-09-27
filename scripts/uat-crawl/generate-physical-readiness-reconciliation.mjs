#!/usr/bin/env node
/** Reconcile 131-surface census vs current-main automated UAT evidence (dynamic SHA). */
import fs from "node:fs";
import path from "node:path";
import { buildDeployProvenanceLabel } from "./crawl-target-policy.mjs";

const ROOT = path.resolve(import.meta.dirname, "../..");
const CURRENT_MAIN_SHA = process.env.UAT_TARGET_SHA?.trim() || "";
const PRIOR_CURRENT_MAIN_HOLD_SHA = "6c7de2a69cec960f709a66fb85d25049dfcc2ae0";
const PRIOR_EVIDENCE_SHA = "e2f123b0fe257b8a1f39ec40d5f544fff1ebe313";
const DEPLOY_URL = process.env.UAT_CRAWL_BASE_URL?.trim() || "";
const RUN_ID = process.env.GITHUB_RUN_ID || "reconcile-local";
const RUN_ATTEMPT = process.env.GITHUB_RUN_ATTEMPT || "1";
const RUN_TRANCHE = process.env.RUN_TRANCHE || "watchdog-continue";
const LAST_GHA_RUN = process.env.UAT_LAST_GHA_RUN?.trim() || RUN_ID;

const PUBLIC_RUNNABLE = new Set(["UAT-0001", "UAT-0004", "UAT-0005", "UAT-0008", "UAT-0009"]);

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

function loadAuthCompleteIds(censusIds) {
  const ids = new Set();
  const isValid = (row) =>
    censusIds.has(row.uatId) &&
    row.runId === RUN_ID &&
    row.wallClassification !== "DEPLOYMENT_PROTECTION" &&
    row.authenticated &&
    row.functionStatus === "OBSERVED" &&
    row.uxEvidence?.s0 &&
    row.uxEvidence?.s3;
  for (const row of loadJsonl("docs/uat-crawl/UAT_MANIFEST_AUTH.jsonl")) {
    if (isValid(row)) ids.add(row.uatId);
  }
  for (const row of loadJsonl("docs/uat-crawl/UAT_MANIFEST_BUYER_MOBILE.jsonl")) {
    if (isValid(row)) ids.add(row.uatId);
  }
  for (const row of loadJsonl("docs/uat-crawl/UAT_MANIFEST_POST_FIX_483.jsonl")) {
    if (
      censusIds.has(row.uatId) &&
      row.runId === RUN_ID &&
      row.wallClassification !== "DEPLOYMENT_PROTECTION" &&
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

function loadAuthGateById(censusIds) {
  const map = new Map();
  const sources = [
    "docs/uat-crawl/UAT_MANIFEST_AUTH.jsonl",
    "docs/uat-crawl/UAT_MANIFEST_BUYER_MOBILE.jsonl",
    "docs/uat-crawl/UAT_MANIFEST_AI_UAT.jsonl",
  ];
  for (const rel of sources) {
    for (const row of loadJsonl(rel)) {
      if (!censusIds.has(row.uatId)) continue;
      if (row.runId !== RUN_ID) continue;
      if (row.authenticated) continue;
      if (row.blockClassification) {
        map.set(row.uatId, row);
      }
    }
  }
  return map;
}

function loadPublicCompleteIds(censusIds) {
  const ids = new Set();
  for (const row of loadJsonl("docs/uat-crawl/UAT_MANIFEST_PUBLIC_CONTINUATION.jsonl")) {
    if (
      censusIds.has(row.uatId) &&
      row.runId === RUN_ID &&
      row.wallClassification !== "DEPLOYMENT_PROTECTION" &&
      row.uxEvidence?.s0
    ) {
      ids.add(row.uatId);
    }
  }
  return ids;
}

function classifyEntry(entry, authComplete, publicComplete, blockersById, authGateById) {
  if (authComplete.has(entry.uatId)) {
    return {
      disposition: "AUTH_S0_S3_COMPLETE",
      s0s3Runnable: "EVIDENCED",
      missingSecretNames: [],
      evidenceSource: "UAT_MANIFEST_AUTH.jsonl (+ buyer/post-fix where applicable)",
    };
  }
  if (PUBLIC_RUNNABLE.has(entry.uatId) && publicComplete.has(entry.uatId)) {
    return {
      disposition: "PUBLIC_S0_OBSERVED",
      s0s3Runnable: "PUBLIC_ONLY",
      missingSecretNames: [],
      evidenceSource: "UAT_MANIFEST_PUBLIC_CONTINUATION.jsonl",
      note: "Public surfaces — S0 observed; full S0–S3 auth N/A without credentials",
    };
  }
  const blocker = blockersById.get(entry.uatId);
  if (blocker) {
    return {
      disposition: blocker.blockClassification === "MISSING_SECRET" ? "BLOCKED" : blocker.blockClassification,
      s0s3Runnable: "BLOCKED",
      missingSecretNames: blocker.missingSecretNames ?? [],
      failId: blocker.failId,
      blockClassification: blocker.blockClassification ?? "MISSING_SECRET",
      evidenceSource: "UAT_VERIFIED_BLOCKERS.jsonl",
    };
  }
  const authGate = authGateById.get(entry.uatId);
  if (authGate?.blockClassification) {
    return {
      disposition: authGate.blockClassification,
      s0s3Runnable: "BLOCKED",
      missingSecretNames: authGate.missingSecretNames ?? [],
      blockClassification: authGate.blockClassification,
      evidenceSource: "auth manifest (current run)",
    };
  }
  return {
    disposition: "NOT_EXECUTED",
    s0s3Runnable: "NOT_EXECUTED",
    missingSecretNames: [],
    blockClassification: "NOT_EXECUTED",
    evidenceSource: "none for current run",
    note: "No current-run evidence row was produced for this census ID.",
  };
}

const census = JSON.parse(
  fs.readFileSync(path.join(ROOT, "docs/uat-crawl/UAT_ROUTE_CENSUS.json"), "utf8"),
).entries;
const censusIds = new Set(census.map((e) => e.uatId));
const authComplete = loadAuthCompleteIds(censusIds);
const publicComplete = loadPublicCompleteIds(censusIds);
const blockers = loadJsonl("docs/uat-crawl/UAT_VERIFIED_BLOCKERS.jsonl").filter(
  (b) => censusIds.has(b.uatId) && b.runId === RUN_ID,
);
const blockersById = new Map(blockers.map((b) => [b.uatId, b]));
const authGateById = loadAuthGateById(censusIds);
const secretPresence = fs.existsSync(path.join(ROOT, "docs/uat-crawl/UAT_SECRET_PRESENCE.json"))
  ? JSON.parse(fs.readFileSync(path.join(ROOT, "docs/uat-crawl/UAT_SECRET_PRESENCE.json"), "utf8"))
  : null;

const rows = census.map((entry) => ({
  uatId: entry.uatId,
  app: entry.app,
  route: entry.route,
  state: entry.state,
  role: entry.persona,
  device: entry.device,
  buildSha: CURRENT_MAIN_SHA,
  deployUrl: DEPLOY_URL,
  ...classifyEntry(entry, authComplete, publicComplete, blockersById, authGateById),
}));

const byDevice = {};
const byDisposition = {};
const byMissingSecret = {};
for (const row of rows) {
  byDevice[row.device] = byDevice[row.device] || {
    total: 0,
    authComplete: 0,
    publicS0: 0,
    blocked: 0,
    otpExternalGate: 0,
    providerGated: 0,
    notExecuted: 0,
  };
  byDevice[row.device].total += 1;
  if (row.disposition === "AUTH_S0_S3_COMPLETE") byDevice[row.device].authComplete += 1;
  else if (row.disposition === "PUBLIC_S0_OBSERVED") byDevice[row.device].publicS0 += 1;
  else if (row.disposition === "BLOCKED") byDevice[row.device].blocked += 1;
  else if (row.disposition === "OTP_EXTERNAL_GATE") byDevice[row.device].otpExternalGate += 1;
  else if (row.disposition === "PROVIDER_GATED") byDevice[row.device].providerGated += 1;
  else if (row.disposition === "NOT_EXECUTED") byDevice[row.device].notExecuted += 1;
  byDisposition[row.disposition] = (byDisposition[row.disposition] || 0) + 1;
  if (row.missingSecretNames?.length) {
    const key = row.missingSecretNames.join(", ");
    byMissingSecret[key] = byMissingSecret[key] || [];
    byMissingSecret[key].push(row.uatId);
  }
}

const missingSecretsUnique = secretPresence
  ? secretPresence.secrets.filter((s) => !s.present).map((s) => s.name)
  : [...new Set(blockers.flatMap((b) => b.missingSecretNames))];

const payload = {
  generatedAt: new Date().toISOString(),
  runId: RUN_ID,
  runAttempt: RUN_ATTEMPT,
  runTranche: RUN_TRANCHE,
  lastGhaRun: LAST_GHA_RUN,
  currentMainSha: CURRENT_MAIN_SHA,
  deployUrl: DEPLOY_URL,
  deployProvenance: buildDeployProvenanceLabel(CURRENT_MAIN_SHA),
  policy:
    "Evidence-only PR #462 — no remediation. Physical device PASS requires human artifacts; automated S0–S3 ≠ physical PASS.",
  counts: {
    censusTotal: rows.length,
    authS0S3Complete: byDisposition.AUTH_S0_S3_COMPLETE || 0,
    publicS0Observed: byDisposition.PUBLIC_S0_OBSERVED || 0,
    blockedCredentialOrDeploy: byDisposition.BLOCKED || 0,
    authFlowFailed: byDisposition.AUTH_FLOW_FAILED || 0,
    authContractMismatch: byDisposition.AUTH_CONTRACT_MISMATCH || 0,
    otpExternalGate: byDisposition.OTP_EXTERNAL_GATE || 0,
    providerGated: byDisposition.PROVIDER_GATED || 0,
    notExecuted: byDisposition.NOT_EXECUTED || 0,
  },
  byDevice,
  byMissingSecret: Object.fromEntries(
    Object.entries(byMissingSecret).map(([k, v]) => [k, { count: v.length, uatIds: v }]),
  ),
  ghaSecretPresence: secretPresence
    ? {
        presentCount: secretPresence.presentCount,
        missingCount: secretPresence.missingCount,
        missingNames: secretPresence.secrets.filter((s) => !s.present).map((s) => s.name),
      }
    : null,
  stopCondition:
    (byDisposition.NOT_EXECUTED || 0) > 0
      ? "INCOMPLETE_CURRENT_RUN_EVIDENCE — one or more census rows were not executed"
      : missingSecretsUnique.length > 0
        ? "ONLY_TEST_SECRET_BLOCKERS — no further automated crawl until repo secrets wired"
        : ((byDisposition.OTP_EXTERNAL_GATE || 0) + (byDisposition.PROVIDER_GATED || 0)) > 0
          ? "AUTOMATED_CRAWL_COMPLETE_WITH_EXTERNAL_PROVIDER_GATES"
          : "AUTOMATED_CRAWL_COMPLETE",
  rows,
};

const jsonPath = path.join(ROOT, "docs/uat-crawl/UAT_PHYSICAL_READINESS_RECONCILIATION.json");
fs.mkdirSync(path.dirname(jsonPath), { recursive: true });
fs.writeFileSync(jsonPath, `${JSON.stringify(payload, null, 2)}\n`);
const currentSummaryPath = path.join(ROOT, "docs/uat-crawl/UAT_CURRENT_RUN_SUMMARY.json");
fs.writeFileSync(
  currentSummaryPath,
  `${JSON.stringify({
    generatedAt: payload.generatedAt,
    runId: RUN_ID,
    runAttempt: RUN_ATTEMPT,
    runTranche: RUN_TRANCHE,
    currentMainSha: CURRENT_MAIN_SHA,
    deployUrl: DEPLOY_URL,
    counts: payload.counts,
    stopCondition: payload.stopCondition,
    byDisposition,
  }, null, 2)}\n`,
);

const mdLines = [
  "# UAT Physical Readiness Reconciliation",
  "",
  `**Generated:** ${payload.generatedAt}`,
  `**Run:** ${RUN_ID} (attempt ${RUN_ATTEMPT}, tranche \`${RUN_TRANCHE}\`)`,
  `**Current main:** \`${CURRENT_MAIN_SHA}\``,
  `**Deploy:** ${DEPLOY_URL}`,
  `**Last GHA evidence run:** [${LAST_GHA_RUN}](https://github.com/oasisbaklawa2006/Oasis-Baklawa-Central/actions/runs/${LAST_GHA_RUN})`,
  "",
  "## Automated S0–S3 disposition (131 census surfaces)",
  "",
  "| Disposition | Count | Meaning |",
  "|---|---:|---|",
  `| AUTH S0–S3 complete | **${payload.counts.authS0S3Complete}** | Governed authenticated crawl evidence on current-main deploy |`,
  `| Public S0 observed | **${payload.counts.publicS0Observed}** | Unauthenticated public continuation (S0 only) |`,
  `| **BLOCKED** (credential/deploy) | **${payload.counts.blockedCredentialOrDeploy}** | Exact \`TEST_*\` secret names in blocker registry |`,
  `| OTP external gate | **${payload.counts.otpExternalGate}** | Current-run row reached governed OTP/provider boundary |`,
  `| Provider gated | **${payload.counts.providerGated}** | Current-run row reached an external provider boundary |`,
  `| Auth flow failed | **${payload.counts.authFlowFailed}** | Current-run authentication attempt failed |`,
  `| Auth contract mismatch | **${payload.counts.authContractMismatch}** | Current-run auth contract mismatch |`,
  `| **NOT EXECUTED** | **${payload.counts.notExecuted}** | No current-run evidence row produced |`,
  "",
  "## By device class",
  "",
  "| Device | Total | Auth S0–S3 | Public S0 | Blocked | OTP gate | Provider gate | Not executed |",
  "|---|---:|---:|---:|---:|---:|---:|---:|",
  ...Object.entries(byDevice).map(
    ([d, c]) => `| ${d} | ${c.total} | ${c.authComplete} | ${c.publicS0} | ${c.blocked} | ${c.otpExternalGate} | ${c.providerGated} | ${c.notExecuted} |`,
  ),
  "",
  "## Current-run unresolved evidence",
  "",
  `- Missing-secret/deploy blockers: **${payload.counts.blockedCredentialOrDeploy}**`,
  `- OTP external gates: **${payload.counts.otpExternalGate}**`,
  `- Provider gates: **${payload.counts.providerGated}**`,
  `- Auth-flow failures: **${payload.counts.authFlowFailed}**`,
  `- Auth-contract mismatches: **${payload.counts.authContractMismatch}**`,
  `- Not executed: **${payload.counts.notExecuted}**`,
  "",
  "## Exact blocker secret groups",
  "",
  ...Object.entries(payload.byMissingSecret).map(
    ([secrets, info]) =>
      `- \`${secrets}\` — **${info.count}** IDs: ${info.uatIds.slice(0, 8).join(", ")}${info.uatIds.length > 8 ? ` … +${info.uatIds.length - 8} more` : ""}`,
  ),
  "",
  "## Stop condition",
  "",
  `**${payload.stopCondition}**`,
  "",
  "No credentials invented. No RBAC bypass. Physical iPhone/tablet/scanner/TV PASS requires separate human evidence packs — not claimed from this automated crawl.",
  "",
  "Preserved append-only: FAIL-493 pre-fix @ `8f042fa`, preview PASS @ `9715c20d`, current-main UAT-005 PASS run 34037424554.",
];

const mdPath = path.join(ROOT, "docs/uat-crawl/UAT_PHYSICAL_READINESS_RECONCILIATION.md");
fs.writeFileSync(mdPath, `${mdLines.join("\n")}\n`);

console.log(
  `Reconciliation: ${payload.counts.authS0S3Complete} auth + ${payload.counts.publicS0Observed} public + ${payload.counts.blockedCredentialOrDeploy} blocked / ${rows.length}`,
);
