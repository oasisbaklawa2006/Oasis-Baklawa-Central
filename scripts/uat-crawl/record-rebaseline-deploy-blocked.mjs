#!/usr/bin/env node
/**
 * Record deploy BLOCKED for current-main rebaseline when no trusted Vercel URL exists
 * for the required SHA. Does not substitute prior e2f123b0 or ace340fe deploys.
 */
import fs from "node:fs";
import path from "node:path";

const ROOT = path.resolve(import.meta.dirname, "../..");
const REQUIRED_SHA =
  process.env.UAT_TARGET_SHA?.trim() || "15c59a3f54c92f2b289bd150005bcd7114b51a93";
const PRIOR_EVIDENCE_SHA = "e2f123b0fe257b8a1f39ec40d5f544fff1ebe313";
const RUN_ID = process.env.GITHUB_RUN_ID || "local";
const RUN_TRANCHE = process.env.RUN_TRANCHE || "watchdog-continue";
const REASON =
  process.env.UAT_DEPLOY_BLOCK_REASON?.trim() ||
  `No successful Vercel deployment for current main ${REQUIRED_SHA}; rebaseline requires exact SHA — no substitution.`;

const PUBLIC_RUNNABLE = new Set(["UAT-0001", "UAT-0004", "UAT-0005", "UAT-0008", "UAT-0009"]);
const CREDENTIAL_BLOCKED_SAMPLE = 46;

function writeJson(relativePath, data) {
  const filePath = path.join(ROOT, relativePath);
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, `${JSON.stringify(data, null, 2)}\n`, "utf8");
}

const now = new Date().toISOString();
const census = JSON.parse(
  fs.readFileSync(path.join(ROOT, "docs/uat-crawl/UAT_ROUTE_CENSUS.json"), "utf8"),
);

writeJson("docs/uat-crawl/UAT_REBASELINE_DEPLOY_BLOCKED.json", {
  generatedAt: now,
  runId: RUN_ID,
  runTranche: RUN_TRANCHE,
  requiredSha: REQUIRED_SHA,
  priorEvidenceSha: PRIOR_EVIDENCE_SHA,
  deployStatus: "BLOCKED",
  reason: REASON,
  vercelRateLimitSuspected: REASON.includes("15c59a3") || REASON.includes("rate"),
  censusTotal: census.entries.length,
  runnableAwaitingTrustedDeploy: 85,
  publicRunnableIds: [...PUBLIC_RUNNABLE],
  credentialBlockedSurfaces: CREDENTIAL_BLOCKED_SAMPLE,
  policy:
    "Prior e2f123b0 authenticated (80) + public (5) evidence preserved append-only — NOT recertified as 15c59a3f without trusted deploy.",
  nextAction:
    "Wire Vercel deploy for 15c59a3f (or TEST_PREVIEW_URL pointing at exact SHA) then re-run watchdog-continue / current-main-rebaseline.",
});

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
  policy: "Do not substitute e2f123b0 or ace340fe as 15c59a3f current-main rebaseline evidence.",
});

console.log(`Recorded rebaseline deploy BLOCKED for ${REQUIRED_SHA} (run ${RUN_ID}).`);
