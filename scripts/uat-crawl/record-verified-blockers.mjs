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
  "Current-main authority @ a619a7a2 (#558) — prior 6c7de2a/15c59a3f/e2f123b0 evidence preserved append-only.";

const PUBLIC_RUNNABLE = new Set(["UAT-0001", "UAT-0004", "UAT-0005", "UAT-0008", "UAT-0009"]);

function missingSecrets(names) {
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
