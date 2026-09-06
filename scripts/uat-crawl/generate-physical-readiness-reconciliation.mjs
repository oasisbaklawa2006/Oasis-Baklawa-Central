#!/usr/bin/env node
/** Reconcile 131-surface census vs current-main automated UAT evidence @ e2f123b0. */
import fs from "node:fs";
import path from "node:path";

const ROOT = path.resolve(import.meta.dirname, "../..");
const CURRENT_MAIN_SHA = "e2f123b0fe257b8a1f39ec40d5f544fff1ebe313";
const DEPLOY_URL =
  process.env.UAT_CRAWL_BASE_URL?.trim() ||
  "https://oasis-baklawa-central-8lkgmf1q2-oasisbaklawa2006-6222s-projects.vercel.app";
const RUN_ID = process.env.GITHUB_RUN_ID || "reconcile-local";
const LAST_GHA_RUN = process.env.UAT_LAST_GHA_RUN?.trim() || "34046709938";

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

function loadAuthCompleteIds() {
  const ids = new Set();
  for (const row of loadJsonl("docs/uat-crawl/UAT_MANIFEST_AUTH.jsonl")) {
    if (row.authenticated && row.functionStatus === "OBSERVED" && row.uxEvidence?.s0 && row.uxEvidence?.s3) {
      ids.add(row.uatId);
    }
  }
  for (const row of loadJsonl("docs/uat-crawl/UAT_MANIFEST_BUYER_MOBILE.jsonl")) {
    if (row.authenticated && row.functionStatus === "OBSERVED" && row.uxEvidence?.s0 && row.uxEvidence?.s3) {
      ids.add(row.uatId);
    }
  }
  for (const row of loadJsonl("docs/uat-crawl/UAT_MANIFEST_POST_FIX_483.jsonl")) {
    if (row.functionStatus === "OBSERVED" && row.uxEvidence?.s0 && row.uxEvidence?.s3) {
      ids.add(row.uatId);
    }
  }
  return ids;
}

function classifyEntry(entry, authComplete, blockersById) {
  if (authComplete.has(entry.uatId)) {
    return {
      disposition: "AUTH_S0_S3_COMPLETE",
      s0s3Runnable: "EVIDENCED",
      missingSecretNames: [],
      evidenceSource: "UAT_MANIFEST_AUTH.jsonl (+ buyer/post-fix where applicable)",
    };
  }
  if (PUBLIC_RUNNABLE.has(entry.uatId)) {
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
      disposition: "BLOCKED",
      s0s3Runnable: "BLOCKED",
      missingSecretNames: blocker.missingSecretNames,
      failId: blocker.failId,
      evidenceSource: "UAT_VERIFIED_BLOCKERS.jsonl",
    };
  }
  return {
    disposition: "NOT_CLASSIFIED",
    s0s3Runnable: "UNKNOWN",
    missingSecretNames: [],
    evidenceSource: "none",
  };
}

const census = JSON.parse(
  fs.readFileSync(path.join(ROOT, "docs/uat-crawl/UAT_ROUTE_CENSUS.json"), "utf8"),
).entries;
const authComplete = loadAuthCompleteIds();
const blockers = loadJsonl("docs/uat-crawl/UAT_VERIFIED_BLOCKERS.jsonl");
const blockersById = new Map(blockers.map((b) => [b.uatId, b]));
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
  ...classifyEntry(entry, authComplete, blockersById),
}));

const byDevice = {};
const byDisposition = {};
const byMissingSecret = {};
for (const row of rows) {
  byDevice[row.device] = byDevice[row.device] || { total: 0, authComplete: 0, publicS0: 0, blocked: 0 };
  byDevice[row.device].total += 1;
  if (row.disposition === "AUTH_S0_S3_COMPLETE") byDevice[row.device].authComplete += 1;
  else if (row.disposition === "PUBLIC_S0_OBSERVED") byDevice[row.device].publicS0 += 1;
  else if (row.disposition === "BLOCKED") byDevice[row.device].blocked += 1;
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
  lastGhaRun: LAST_GHA_RUN,
  currentMainSha: CURRENT_MAIN_SHA,
  deployUrl: DEPLOY_URL,
  deployProvenance: "Current-main #497 merge @ e2f123b0 — automated crawl target",
  policy:
    "Evidence-only PR #462 — no remediation. Physical device PASS requires human artifacts; automated S0–S3 ≠ physical PASS.",
  counts: {
    censusTotal: rows.length,
    authS0S3Complete: byDisposition.AUTH_S0_S3_COMPLETE || 0,
    publicS0Observed: byDisposition.PUBLIC_S0_OBSERVED || 0,
    blockedCredentialOrDeploy: byDisposition.BLOCKED || 0,
    notClassified: byDisposition.NOT_CLASSIFIED || 0,
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
    missingSecretsUnique.length > 0
      ? "ONLY_TEST_SECRET_BLOCKERS — no further automated crawl until repo secrets wired"
      : "CREDENTIALS_AVAILABLE — dispatch watchdog-continue",
  rows,
};

const jsonPath = path.join(ROOT, "docs/uat-crawl/UAT_PHYSICAL_READINESS_RECONCILIATION.json");
fs.mkdirSync(path.dirname(jsonPath), { recursive: true });
fs.writeFileSync(jsonPath, `${JSON.stringify(payload, null, 2)}\n`);

const mdLines = [
  "# UAT Physical Readiness Reconciliation",
  "",
  `**Generated:** ${payload.generatedAt}`,
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
  "",
  "## By device class",
  "",
  "| Device | Total | Auth S0–S3 | Public S0 | Blocked |",
  "|---|---:|---:|---:|---:|",
  ...Object.entries(byDevice).map(
    ([d, c]) => `| ${d} | ${c.total} | ${c.authComplete} | ${c.publicS0} | ${c.blocked} |`,
  ),
  "",
  "## Runnable now vs blocked (automated crawl)",
  "",
  "| Runnable now | Blocked |",
  "|---|---|",
  `| Re-refresh **${payload.counts.authS0S3Complete}** auth surfaces + **${payload.counts.publicS0Observed}** public S0 (existing creds in GHA) | **${payload.counts.blockedCredentialOrDeploy}** surfaces — **only** missing \`TEST_*\` repo secrets / deploy URLs |`,
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
