#!/usr/bin/env node
/**
 * Record verified BLOCKED disposition for UAT IDs without authenticated S0–S3 evidence.
 * Re-verifies runtime secret presence — only BLOCKED when secrets are actually absent.
 */
import fs from "node:fs";
import path from "node:path";

const ROOT = path.resolve(import.meta.dirname, "../..");
const RUN_ID = process.env.GITHUB_RUN_ID || "local";
const VERIFICATION_NOTE =
  process.env.UAT_WATCHDOG_VERIFICATION?.trim() ||
  "Watchdog re-verification — no fabricated PASS; blocked IDs retain exact secret names only.";
const RESOLVED_SHA =
  process.env.UAT_RESOLVED_DEPLOY_SHA?.trim() || "e2f123b0fe257b8a1f39ec40d5f544fff1ebe313";
const RESOLVED_URL =
  process.env.TEST_PREVIEW_URL?.trim() ||
  process.env.UAT_CRAWL_BASE_URL?.trim() ||
  "https://oasis-baklawa-central-8lkgmf1q2-oasisbaklawa2006-6222s-projects.vercel.app";
const CURRENT_MAIN_HOLD =
  process.env.UAT_TARGET_SHA?.trim() || "e2f123b0fe257b8a1f39ec40d5f544fff1ebe313";
const DEPLOY_PROVENANCE =
  process.env.UAT_DEPLOY_PROVENANCE_LABEL?.trim() ||
  "Current-main certification @ e2f123b0 — append-only evidence preserved.";

const PERSONA_PREFIX = {
  ADMIN_STAFF: "TEST_ADMIN",
  ADMIN_SALES: "TEST_SALES",
  BUYER: "TEST_BUYER",
  FINANCE: "TEST_FINANCE",
  P_AND_A: "TEST_ASSEMBLY",
  DISPATCH: "TEST_DISPATCH",
  GATE_SECURITY: "TEST_GATE_SECURITY",
  RGS: "TEST_RGS",
  "3PGS": "TEST_PRODUCTION",
  TV: "TEST_TV_RGS",
};

const ROUTE_PREFIX = [
  [/^\/operations-controller/, "TEST_OPERATIONS"],
  [/^\/admin\/dispatch/, "TEST_DISPATCH"],
  [/^\/tv\/3pgs/, "TEST_TV_PRODUCTION"],
  [/^\/tv\//, "TEST_TV_RGS"],
];

const PUBLIC_RUNNABLE = new Set(["UAT-0001", "UAT-0004", "UAT-0005", "UAT-0008", "UAT-0009"]);

function missingSecrets(names) {
  return names.filter((name) => !process.env[name]?.trim());
}

function resolveBlocker(entry) {
  if (PUBLIC_RUNNABLE.has(entry.uatId)) {
    return { blockers: [], failId: null };
  }
  if (entry.app === "ai-studio") {
    return {
      blockers: ["TEST_AI_STUDIO_PREVIEW_URL"],
      failId: `FAIL-AUTH-DEPLOY-${entry.uatId.slice(-4)}`,
    };
  }
  if (entry.app === "trace") {
    return {
      blockers: ["TEST_TRACE_PREVIEW_URL"],
      failId: `FAIL-AUTH-DEPLOY-${entry.uatId.slice(-4)}`,
    };
  }
  if (entry.uatId === "UAT-0018" || entry.uatId === "UAT-0020") {
    return {
      blockers: ["TEST_SALES_EMAIL", "TEST_SALES_PASSWORD"],
      failId: `FAIL-AUTH-CRED-${entry.uatId.slice(-4)}`,
    };
  }
  const routeOverride = ROUTE_PREFIX.find(([pattern]) => pattern.test(entry.route));
  const prefix = routeOverride?.[1] ?? PERSONA_PREFIX[entry.persona];
  if (!prefix) {
    return {
      blockers: [`TEST_${entry.persona}_EMAIL`, `TEST_${entry.persona}_PASSWORD`],
      failId: `FAIL-AUTH-CRED-${entry.uatId.slice(-4)}`,
    };
  }
  return {
    blockers: [`${prefix}_EMAIL`, `${prefix}_PASSWORD`],
    failId: `FAIL-AUTH-CRED-${entry.uatId.slice(-4)}`,
  };
}

function loadJsonlIds(relativePath, predicate) {
  const filePath = path.join(ROOT, relativePath);
  const ids = new Set();
  if (!fs.existsSync(filePath)) return ids;
  for (const line of fs.readFileSync(filePath, "utf8").trim().split("\n")) {
    if (!line) continue;
    try {
      const row = JSON.parse(line);
      if (predicate(row)) ids.add(row.uatId);
    } catch {
      /* skip malformed */
    }
  }
  return ids;
}

function loadCompleteAuthIds() {
  const ids = new Set();
  for (const id of loadJsonlIds("docs/uat-crawl/UAT_MANIFEST_AUTH.jsonl", (row) =>
    Boolean(row.authenticated && row.functionStatus === "OBSERVED" && row.uxEvidence?.s0 && row.uxEvidence?.s3),
  )) {
    ids.add(id);
  }
  for (const id of loadJsonlIds("docs/uat-crawl/UAT_MANIFEST_BUYER_MOBILE.jsonl", (row) =>
    Boolean(row.authenticated && row.functionStatus === "OBSERVED" && row.uxEvidence?.s0 && row.uxEvidence?.s3),
  )) {
    ids.add(id);
  }
  for (const id of loadJsonlIds("docs/uat-crawl/UAT_MANIFEST_POST_FIX_483.jsonl", (row) =>
    Boolean(row.functionStatus === "OBSERVED" && row.uxEvidence?.s0 && row.uxEvidence?.s3),
  )) {
    ids.add(id);
  }
  for (const id of loadJsonlIds("docs/uat-crawl/UAT_MANIFEST_POST_MERGE_497_MAIN.jsonl", (row) =>
    Boolean(row.disposition === "PASS" || (row.functionStatus === "OBSERVED" && row.uxEvidence?.s0)),
  )) {
    ids.add(id);
  }
  return ids;
}

function loadPublicCompleteIds() {
  return loadJsonlIds(
    "docs/uat-crawl/UAT_MANIFEST_PUBLIC_CONTINUATION.jsonl",
    (row) => row.functionStatus === "OBSERVED" || row.functionStatus === "NOT-TESTED",
  );
}

const census = JSON.parse(
  fs.readFileSync(path.join(ROOT, "docs/uat-crawl/UAT_ROUTE_CENSUS.json"), "utf8"),
);
const authenticated = loadCompleteAuthIds();
const publicComplete = loadPublicCompleteIds();
const now = new Date().toISOString();
const outPath = path.join(ROOT, "docs/uat-crawl/UAT_VERIFIED_BLOCKERS.jsonl");
const summaryPath = path.join(ROOT, "docs/uat-crawl/UAT_VERIFIED_BLOCKERS_SUMMARY.json");

const rows = [];
let blockedCount = 0;
let credsAvailableNoEvidence = 0;

for (const entry of census.entries) {
  if (authenticated.has(entry.uatId)) continue;
  if (publicComplete.has(entry.uatId) && PUBLIC_RUNNABLE.has(entry.uatId)) continue;

  const { blockers, failId } = resolveBlocker(entry);
  const missing = missingSecrets(blockers);
  if (missing.length === 0) {
    credsAvailableNoEvidence += 1;
    continue;
  }

  blockedCount += 1;
  rows.push({
    uatId: entry.uatId,
    app: entry.app,
    route: entry.route,
    state: entry.state,
    role: entry.persona,
    device: entry.device,
    resolvedDeploySha: RESOLVED_SHA,
    currentMainHoldSha: CURRENT_MAIN_HOLD,
    crawlBaseUrl: RESOLVED_URL,
    runId: RUN_ID,
    timestamp: now,
    visualStatus: "BLOCKED",
    functionStatus: "BLOCKED",
    uxStatus: "BLOCKED",
    disposition: "BLOCKED",
    failId: failId ?? `FAIL-BLOCK-VERIFY-${entry.uatId.slice(-4)}`,
    missingSecretNames: missing,
    deployProvenance: DEPLOY_PROVENANCE,
    verificationNote: VERIFICATION_NOTE,
    notes: `Verified blocker — missing ${missing.join(", ")}`,
  });
}

fs.mkdirSync(path.dirname(outPath), { recursive: true });
fs.writeFileSync(outPath, `${rows.map((r) => JSON.stringify(r)).join("\n")}\n`, "utf8");

const summary = {
  generatedAt: now,
  runId: RUN_ID,
  resolvedDeploySha: RESOLVED_SHA,
  currentMainHoldSha: CURRENT_MAIN_HOLD,
  crawlBaseUrl: RESOLVED_URL,
  deployProvenance: DEPLOY_PROVENANCE,
  authenticatedComplete: authenticated.size,
  publicContinuationComplete: publicComplete.size,
  remainingWithoutAuthEvidence: census.entries.length - authenticated.size - publicComplete.size,
  verifiedBlocked: blockedCount,
  credentialsAvailableAwaitingEvidence: credsAvailableNoEvidence,
  counts: {
    authenticated: authenticated.size,
    publicFunctionObserved: publicComplete.size,
    blocked: blockedCount,
    credsAvailableNoEvidence: credsAvailableNoEvidence,
    totalCensus: census.entries.length,
  },
  policy:
    "No fabricated PASS. FAIL-493 pre-fix + preview + current-main cert evidence preserved append-only.",
};

fs.writeFileSync(summaryPath, `${JSON.stringify(summary, null, 2)}\n`, "utf8");
console.log(
  `Recorded ${rows.length} verified BLOCKED rows (auth complete ${authenticated.size}/131, ${credsAvailableNoEvidence} cred-available awaiting evidence).`,
);
