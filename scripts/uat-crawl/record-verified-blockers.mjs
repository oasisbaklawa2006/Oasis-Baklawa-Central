#!/usr/bin/env node
/**
 * Record verified BLOCKED disposition for UAT IDs without authenticated S0–S3 evidence.
 * Re-verifies runtime secret presence — only BLOCKED when secrets are actually absent.
 */
import fs from "node:fs";
import path from "node:path";
import { resolveCredentialBlocker } from "./credential-prefix-aliases.mjs";

const ROOT = path.resolve(import.meta.dirname, "../..");
const RUN_ID = process.env.GITHUB_RUN_ID || "local";
const RUN_TRANCHE = process.env.RUN_TRANCHE || "unknown";
const MODE = process.argv[2] ?? "blockers";

const VERIFICATION_NOTE =
  process.env.UAT_WATCHDOG_VERIFICATION?.trim() ||
  "Watchdog re-verification — no fabricated PASS; blocked IDs retain exact secret names only.";
const RESOLVED_SHA =
  process.env.UAT_RESOLVED_DEPLOY_SHA?.trim() || "a619a7a2ef01ee889d32fffebb5ff13fe3181252";
const RESOLVED_URL =
  process.env.TEST_PREVIEW_URL?.trim() ||
  process.env.UAT_CRAWL_BASE_URL?.trim() ||
  "";
const CURRENT_MAIN_HOLD =
  process.env.UAT_TARGET_SHA?.trim() || "a619a7a2ef01ee889d32fffebb5ff13fe3181252";
const DEPLOY_PROVENANCE =
  process.env.UAT_DEPLOY_PROVENANCE_LABEL?.trim() ||
  "Current-main authority (resolved dynamically at run time) — prior pinned-SHA evidence preserved append-only.";

const PUBLIC_RUNNABLE = new Set(["UAT-0001", "UAT-0004", "UAT-0005", "UAT-0008", "UAT-0009"]);

function loadSecretPresenceMap() {
  const filePath = path.join(ROOT, "docs/uat-crawl/UAT_SECRET_PRESENCE.json");
  if (!fs.existsSync(filePath)) return null;
  try {
    const payload = JSON.parse(fs.readFileSync(filePath, "utf8"));
    if (payload.runId && payload.runId !== RUN_ID) return null;
    return new Map(payload.secrets.map((entry) => [entry.name, entry.present]));
  } catch {
    return null;
  }
}

function missingSecrets(names) {
  const presence = loadSecretPresenceMap();
  if (presence) {
    return names.filter((name) => !presence.get(name));
  }
  return names.filter((name) => !process.env[name]?.trim());
}

function resolveBlocker(entry) {
  if (PUBLIC_RUNNABLE.has(entry.uatId)) {
    return { blockers: [], failId: null, wiredPrefix: null };
  }
  if (entry.app === "ai-studio") {
    return {
      blockers: ["TEST_AI_STUDIO_PREVIEW_URL"],
      failId: `FAIL-AUTH-DEPLOY-${entry.uatId.slice(-4)}`,
      wiredPrefix: null,
    };
  }
  if (entry.app === "trace") {
    return {
      blockers: ["TEST_TRACE_PREVIEW_URL"],
      failId: `FAIL-AUTH-DEPLOY-${entry.uatId.slice(-4)}`,
      wiredPrefix: null,
    };
  }
  if (entry.uatId === "UAT-0018" || entry.uatId === "UAT-0020") {
    return {
      blockers: ["TEST_SALES_EMAIL", "TEST_SALES_PASSWORD"],
      failId: `FAIL-AUTH-CRED-${entry.uatId.slice(-4)}`,
      wiredPrefix: null,
    };
  }
  const resolution = resolveCredentialBlocker(entry.persona, entry.route);
  if (resolution.wired) {
    return { blockers: [], failId: null, wiredPrefix: resolution.wiredPrefix };
  }
  return {
    blockers: resolution.missingSecretNames,
    failId: `FAIL-AUTH-CRED-${entry.uatId.slice(-4)}`,
    wiredPrefix: null,
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
  const isValidAuthRow = (row) =>
    row.wallClassification !== "DEPLOYMENT_PROTECTION" &&
    row.blockClassification !== "DEPLOYMENT_PROTECTION" &&
    Boolean(row.authenticated && row.functionStatus === "OBSERVED" && row.uxEvidence?.s0 && row.uxEvidence?.s3);
  for (const id of loadJsonlIds("docs/uat-crawl/UAT_MANIFEST_AUTH.jsonl", isValidAuthRow)) {
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

function readJsonIfExists(filePath) {
  try {
    return JSON.parse(fs.readFileSync(filePath, "utf8"));
  } catch {
    return null;
  }
}

function loadManifestJsonl(filePath) {
  try {
    return fs
      .readFileSync(filePath, "utf8")
      .trim()
      .split("\n")
      .filter(Boolean)
      .map((line) => JSON.parse(line));
  } catch {
    return [];
  }
}

function runScreenshotWallAudit() {
  const minRoutes = Number.parseInt(process.env.UAT_SCREENSHOT_WALL_MIN_ROUTES || "5", 10);
  const manifestPath = path.join(ROOT, "docs/uat-crawl/UAT_MANIFEST.jsonl");
  const authPath = path.join(ROOT, "docs/uat-crawl/UAT_MANIFEST_AUTH.jsonl");
  const publicPath = path.join(ROOT, "docs/uat-crawl/UAT_MANIFEST_PUBLIC_CONTINUATION.jsonl");
  const rows = [...loadManifestJsonl(manifestPath), ...loadManifestJsonl(authPath), ...loadManifestJsonl(publicPath)].filter(
    (row) => !row.runId || row.runId === RUN_ID,
  );
  const byHash = new Map();
  for (const row of rows) {
    if (!row.screenshotSha256 || row.visualStatus === "BLOCKED") continue;
    const list = byHash.get(row.screenshotSha256) ?? [];
    list.push(row);
    byHash.set(row.screenshotSha256, list);
  }
  const walls = [];
  for (const [hash, group] of byHash) {
    const routes = new Set(group.map((r) => r.route));
    if (group.length >= minRoutes && routes.size >= minRoutes) {
      walls.push({ hash, uatIds: group.map((r) => r.uatId), routes: [...routes] });
    }
  }
  const wallDetected = walls.length > 0;
  const outPath = path.join(ROOT, "docs/uat-crawl/UAT_SCREENSHOT_WALL_AUDIT.json");
  fs.mkdirSync(path.dirname(outPath), { recursive: true });
  fs.writeFileSync(
    outPath,
    `${JSON.stringify(
      {
        generatedAt: new Date().toISOString(),
        runId: RUN_ID,
        wallDetected,
        minRoutes,
        walls,
        policy:
          "Duplicate hashes across many routes may indicate Vercel auth wall — combined with title/URL/origin guards, not standalone defect classification.",
      },
      null,
      2,
    )}\n`,
  );
  if (wallDetected) {
    console.error(
      `::warning::Possible screenshot wall detected — ${walls.length} hash group(s) shared across >=${minRoutes} routes.`,
    );
  } else {
    console.log("Screenshot wall audit: no dominant duplicate-hash wall detected.");
  }
}

function runCrawlVerdict() {
  const failures = [];
  const warnings = [];
  const outcomesPath = path.join(ROOT, "docs/uat-crawl/UAT_CRAWL_STEP_OUTCOMES.json");
  const stepOutcomes = readJsonIfExists(outcomesPath) ?? {};

  if (process.env.UAT_DEPLOY_BLOCKED === "true") {
    failures.push("DEPLOY_BLOCKED: no trusted crawl target for current-main tranche");
  }
  for (const [step, outcome] of Object.entries(stepOutcomes)) {
    if (outcome === "failure" || outcome === "cancelled") failures.push(`STEP_FAILED:${step}`);
  }
  if (stepOutcomes.ai_uat === "failure") failures.push("AI_UAT_SUITE_FAILED");
  if (stepOutcomes.post_fix_483 === "failure") failures.push("POST_FIX_483_SUITE_FAILED");

  const blockersSummary = readJsonIfExists(path.join(ROOT, "docs/uat-crawl/UAT_VERIFIED_BLOCKERS_SUMMARY.json"));
  if (blockersSummary?.denominatorReconciled === false) failures.push("CENSUS_RECONCILIATION_FAILED");

  const aiSummary = readJsonIfExists(path.join(ROOT, "docs/uat-crawl/UAT_AI_UAT_SUMMARY.json"));
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

  const ghaRun = readJsonIfExists(path.join(ROOT, "docs/uat-crawl/UAT_GHA_RUN.json"));
  if (ghaRun?.deployBlocked === true) failures.push("GHA_RUN_DEPLOY_BLOCKED");
  if (
    ghaRun?.crawlTargetType &&
    ghaRun.crawlTargetType !== "PUBLIC_PRODUCTION_ALIAS" &&
    ghaRun.runTranche?.includes("watchdog")
  ) {
    warnings.push(`CRAWL_TARGET_TYPE:${ghaRun.crawlTargetType}`);
  }

  const protectionRows = loadManifestJsonl(path.join(ROOT, "docs/uat-crawl/UAT_MANIFEST.jsonl"))
    .concat(loadManifestJsonl(path.join(ROOT, "docs/uat-crawl/UAT_MANIFEST_AUTH.jsonl")))
    .filter(
      (row) => row.blockClassification === "DEPLOYMENT_PROTECTION" || row.wallClassification === "DEPLOYMENT_PROTECTION",
    );
  if (protectionRows.length > 0) {
    failures.push(`DEPLOYMENT_PROTECTION:${protectionRows.map((r) => r.uatId).join(",")}`);
  }

  const rebaseline = readJsonIfExists(path.join(ROOT, "docs/uat-crawl/UAT_REBASELINE_CURRENT_MAIN.json"));
  if (rebaseline?.runId === RUN_ID && rebaseline.deployProvenance?.includes("a619a7a2")) {
    failures.push("STALE_PROVENANCE_LABEL_IN_REBASELINE");
  }
  const provenance = readJsonIfExists(path.join(ROOT, "docs/uat-crawl/UAT_DEPLOY_PROVENANCE.json"));
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
}

if (MODE === "screenshot-wall") {
  runScreenshotWallAudit();
  process.exit(0);
}
if (MODE === "verdict") {
  runCrawlVerdict();
  process.exit(process.exitCode ?? 0);
}

const census = JSON.parse(
  fs.readFileSync(path.join(ROOT, "docs/uat-crawl/UAT_ROUTE_CENSUS.json"), "utf8"),
);

// Denominator-reconciliation fix (UAT-DENOM-MISMATCH tooling defect): manifest files are
// append-only across the programme's history and can retain UAT IDs that no longer exist in
// the current route census (a route renamed/removed, or a stale re-run against an older
// census snapshot). Counting those IDs inflated `authenticated`/`publicComplete` beyond what
// the per-entry loop below actually accounts for, so the published summary's categories no
// longer summed to the census total. Every count in this script is now intersected against
// the CURRENT census entries before it is reported.
const censusIds = new Set(census.entries.map((e) => e.uatId));
const authenticated = new Set([...loadCompleteAuthIds()].filter((id) => censusIds.has(id)));
const publicComplete = new Set([...loadPublicCompleteIds()].filter((id) => censusIds.has(id)));
const now = new Date().toISOString();
const outPath = path.join(ROOT, "docs/uat-crawl/UAT_VERIFIED_BLOCKERS.jsonl");
const summaryPath = path.join(ROOT, "docs/uat-crawl/UAT_VERIFIED_BLOCKERS_SUMMARY.json");

const rows = [];
let blockedCount = 0;
let credsAvailableNoEvidence = 0;
// Explicit count of census entries actually skipped via the public-continuation branch below —
// this, not publicComplete.size, is the number that must reconcile against the census total,
// since publicComplete can (correctly) contain IDs outside PUBLIC_RUNNABLE that this loop does
// not skip on.
let publicSkipped = 0;
const categoryById = new Map();
const duplicateMemberships = [];

function assignCategory(uatId, category) {
  const prior = categoryById.get(uatId);
  if (prior && prior !== category) {
    duplicateMemberships.push({ uatId, prior, next: category });
  }
  categoryById.set(uatId, category);
}

for (const entry of census.entries) {
  if (authenticated.has(entry.uatId)) {
    assignCategory(entry.uatId, "authenticated");
    continue;
  }
  if (publicComplete.has(entry.uatId) && PUBLIC_RUNNABLE.has(entry.uatId)) {
    assignCategory(entry.uatId, "publicSkipped");
    publicSkipped += 1;
    continue;
  }

  const { blockers, failId } = resolveBlocker(entry);
  const missing = missingSecrets(blockers);
  if (missing.length === 0) {
    assignCategory(entry.uatId, "credsAvailable");
    credsAvailableNoEvidence += 1;
    continue;
  }

  assignCategory(entry.uatId, "blocked");
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

// Reconciliation guard: every census entry must land in exactly one of authenticated /
// publicSkipped / blocked / credsAvailable. If it doesn't, refuse to silently publish an
// inconsistent summary — fail this (continue-on-error) CI step loudly instead so the mismatch
// is visible in the run rather than only discoverable by manual arithmetic later.
const reconciledTotal = authenticated.size + publicSkipped + blockedCount + credsAvailableNoEvidence;
const missingCensusIds = census.entries.filter((e) => !categoryById.has(e.uatId)).map((e) => e.uatId);
const extraIds = [...categoryById.keys()].filter((id) => !censusIds.has(id));
const reconciled =
  reconciledTotal === census.entries.length &&
  duplicateMemberships.length === 0 &&
  missingCensusIds.length === 0 &&
  extraIds.length === 0;
if (!reconciled) {
  console.error(
    `::error::UAT denominator reconciliation failed: authenticated(${authenticated.size}) + publicSkipped(${publicSkipped}) + blocked(${blockedCount}) + credsAvailable(${credsAvailableNoEvidence}) = ${reconciledTotal}, expected census total ${census.entries.length}.`,
  );
}
if (duplicateMemberships.length > 0) {
  console.error(
    `::error::UAT exclusive-category duplication detected: ${duplicateMemberships
      .map((d) => `${d.uatId}(${d.prior}+${d.next})`)
      .join(", ")}`,
  );
}
if (missingCensusIds.length > 0 || extraIds.length > 0) {
  console.error(
    `::error::UAT census membership mismatch — missing=${missingCensusIds.join(",")} extra=${extraIds.join(",")}`,
  );
}

fs.mkdirSync(path.dirname(outPath), { recursive: true });
const archivePath = path.join(ROOT, "docs/uat-crawl/UAT_VERIFIED_BLOCKERS_ARCHIVE.jsonl");
if (fs.existsSync(outPath)) {
  fs.appendFileSync(archivePath, fs.readFileSync(outPath, "utf8"));
}
fs.writeFileSync(outPath, `${rows.map((r) => JSON.stringify(r)).join("\n")}\n`, "utf8");

const summary = {
  generatedAt: now,
  runId: RUN_ID,
  resolvedDeploySha: RESOLVED_SHA,
  currentMainHoldSha: CURRENT_MAIN_HOLD,
  crawlBaseUrl: RESOLVED_URL,
  deployProvenance: DEPLOY_PROVENANCE,
  authenticatedComplete: authenticated.size,
  publicContinuationComplete: publicSkipped,
  remainingWithoutAuthEvidence: blockedCount + credsAvailableNoEvidence,
  verifiedBlocked: blockedCount,
  credentialsAvailableAwaitingEvidence: credsAvailableNoEvidence,
  denominatorReconciled: reconciled,
  duplicateMemberships,
  missingCensusIds,
  extraCategoryIds: extraIds,
  counts: {
    authenticated: authenticated.size,
    publicFunctionObserved: publicSkipped,
    blocked: blockedCount,
    credsAvailableNoEvidence: credsAvailableNoEvidence,
    totalCensus: census.entries.length,
    reconciledTotal,
  },
  policy:
    "No fabricated PASS. FAIL-493 pre-fix + preview + current-main cert evidence preserved append-only.",
};

fs.writeFileSync(summaryPath, `${JSON.stringify(summary, null, 2)}\n`, "utf8");
console.log(
  `Recorded ${rows.length} verified BLOCKED rows (auth complete ${authenticated.size}/${census.entries.length}, ${credsAvailableNoEvidence} cred-available awaiting evidence, reconciled=${reconciled}).`,
);

if (!reconciled) {
  process.exitCode = 1;
}
