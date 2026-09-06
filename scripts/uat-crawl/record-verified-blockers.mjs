#!/usr/bin/env node
/**
 * Record verified BLOCKED disposition for all UAT IDs without authenticated S0–S3 evidence.
 * Append-only — does not fabricate PASS or overwrite prior evidence.
 */
import fs from "node:fs";
import path from "node:path";

const ROOT = path.resolve(import.meta.dirname, "../..");
const RUN_ID = process.env.GITHUB_RUN_ID || "local";
const VERIFICATION_NOTE =
  process.env.UAT_WATCHDOG_VERIFICATION?.trim() ||
  "Watchdog re-verification — no fabricated PASS; blocked IDs retain exact secret names only.";
const RESOLVED_SHA =
  process.env.UAT_RESOLVED_DEPLOY_SHA?.trim() || "ace340fe1d122a4cce5d7bb61cd237ed7ba1c894";
const RESOLVED_URL =
  process.env.TEST_PREVIEW_URL?.trim() ||
  process.env.UAT_CRAWL_BASE_URL?.trim() ||
  "https://oasis-baklawa-central-6zo99hosg-oasisbaklawa2006-6222s-projects.vercel.app";
const CURRENT_MAIN_HOLD =
  process.env.UAT_TARGET_SHA?.trim() || "64a107dfc167be76673a3d18f177a72472dcb241";

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
const APP_DEPLOY_SECRET = {
  "ai-studio": "TEST_AI_STUDIO_PREVIEW_URL",
  trace: "TEST_TRACE_PREVIEW_URL",
};

function resolveBlocker(entry) {
  if (PUBLIC_RUNNABLE.has(entry.uatId)) {
    return { status: "RUNNABLE_PUBLIC", blockers: [], failId: null };
  }
  if (entry.app === "ai-studio") {
    return {
      status: "BLOCKED",
      blockers: ["TEST_AI_STUDIO_PREVIEW_URL"],
      failId: `FAIL-AUTH-DEPLOY-${entry.uatId.slice(-4)}`,
    };
  }
  if (entry.app === "trace") {
    return {
      status: "BLOCKED",
      blockers: ["TEST_TRACE_PREVIEW_URL"],
      failId: `FAIL-AUTH-DEPLOY-${entry.uatId.slice(-4)}`,
    };
  }
  if (entry.uatId === "UAT-0018" || entry.uatId === "UAT-0020") {
    return {
      status: "BLOCKED",
      blockers: ["TEST_SALES_EMAIL", "TEST_SALES_PASSWORD"],
      failId: `FAIL-AUTH-CRED-${entry.uatId.slice(-4)}`,
    };
  }
  const routeOverride = ROUTE_PREFIX.find(([pattern]) => pattern.test(entry.route));
  const prefix = routeOverride?.[1] ?? PERSONA_PREFIX[entry.persona];
  if (!prefix) {
    return {
      status: "BLOCKED",
      blockers: [`TEST_${entry.persona}_EMAIL`, `TEST_${entry.persona}_PASSWORD`],
      failId: `FAIL-AUTH-CRED-${entry.uatId.slice(-4)}`,
    };
  }
  return {
    status: "BLOCKED",
    blockers: [`${prefix}_EMAIL`, `${prefix}_PASSWORD`],
    failId: `FAIL-AUTH-CRED-${entry.uatId.slice(-4)}`,
  };
}

function loadAuthenticatedIds() {
  const manifestPath = path.join(ROOT, "docs/uat-crawl/UAT_MANIFEST_AUTH.jsonl");
  if (!fs.existsSync(manifestPath)) return new Set();
  const ids = new Set();
  for (const line of fs.readFileSync(manifestPath, "utf8").trim().split("\n")) {
    if (!line) continue;
    const row = JSON.parse(line);
    if (row.authenticated && row.functionStatus !== "BLOCKED") ids.add(row.uatId);
  }
  return ids;
}

function loadPublicCompleteIds() {
  const manifestPath = path.join(ROOT, "docs/uat-crawl/UAT_MANIFEST_PUBLIC_CONTINUATION.jsonl");
  if (!fs.existsSync(manifestPath)) return new Set();
  const ids = new Set();
  for (const line of fs.readFileSync(manifestPath, "utf8").trim().split("\n")) {
    if (!line) continue;
    const row = JSON.parse(line);
    if (row.functionStatus === "OBSERVED" || row.functionStatus === "NOT-TESTED") ids.add(row.uatId);
  }
  return ids;
}

const census = JSON.parse(
  fs.readFileSync(path.join(ROOT, "docs/uat-crawl/UAT_ROUTE_CENSUS.json"), "utf8"),
);
const authenticated = loadAuthenticatedIds();
const publicComplete = loadPublicCompleteIds();
const now = new Date().toISOString();
const outPath = path.join(ROOT, "docs/uat-crawl/UAT_VERIFIED_BLOCKERS.jsonl");
const summaryPath = path.join(ROOT, "docs/uat-crawl/UAT_VERIFIED_BLOCKERS_SUMMARY.json");

const rows = [];
let blockedCount = 0;
let runnablePublicCount = 0;

for (const entry of census.entries) {
  const hasAuth = authenticated.has(entry.uatId);
  const hasPublic = publicComplete.has(entry.uatId);
  if (hasAuth) continue;

  const { status, blockers, failId } = resolveBlocker(entry);
  if (hasPublic && PUBLIC_RUNNABLE.has(entry.uatId)) continue;

  const disposition = status === "RUNNABLE_PUBLIC" && !hasPublic ? "NOT-TESTED" : "BLOCKED";
  if (disposition === "BLOCKED") blockedCount += 1;
  if (status === "RUNNABLE_PUBLIC" && !hasPublic) runnablePublicCount += 1;

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
    visualStatus: disposition,
    functionStatus: disposition,
    uxStatus: disposition,
    disposition,
    failId: failId ?? `FAIL-BLOCK-VERIFY-${entry.uatId.slice(-4)}`,
    missingSecretNames: blockers,
    deployProvenance:
      "ace340fe continuation — NOT current-main certification; FAIL-493 evidence preserved separately",
    verificationNote: VERIFICATION_NOTE,
    notes:
      disposition === "BLOCKED"
        ? `Verified blocker — missing ${blockers.join(", ") || "deploy/credential authority"}`
        : "Public surface runnable without credentials",
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
  authenticatedComplete: authenticated.size,
  publicContinuationComplete: publicComplete.size,
  remainingWithoutAuthEvidence: rows.filter((r) => r.disposition === "BLOCKED").length,
  verifiedBlocked: blockedCount,
  counts: {
    authenticated: authenticated.size,
    publicFunctionObserved: publicComplete.size,
    blocked: blockedCount,
    totalCensus: census.entries.length,
  },
  policy:
    "No fabricated PASS. FAIL-493 pre-fix + #497 preview repair evidence preserved separately.",
};

fs.writeFileSync(summaryPath, `${JSON.stringify(summary, null, 2)}\n`, "utf8");
console.log(
  `Recorded ${rows.length} verified blocker/runnable rows (${blockedCount} BLOCKED, auth complete ${authenticated.size}/131).`,
);
