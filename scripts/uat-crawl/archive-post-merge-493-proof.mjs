#!/usr/bin/env node
/** Archive FAST PATH A (#493) AI-UAT evidence — append-only; preserves prior UAT-005 FAIL rows. */
import fs from "node:fs";
import path from "node:path";

const ROOT = path.resolve(import.meta.dirname, "../..");
const append = process.argv.includes("--append");
const RUN_ID = process.env.GITHUB_RUN_ID || "local";
const DEPLOY_SHA = process.env.FAST_PATH_493_SHA?.trim() || "8f042fa4abd70eba4e56636883dbcfaf30c864c7";
const DEPLOY_ID = process.env.FAST_PATH_493_DEPLOYMENT_ID?.trim() || "6289603800";
const MERGE_SHA = "3bebf39c7327ed28951d4ad68a8db4c19e0f6717";
const BASE_URL =
  process.env.FAST_PATH_493_URL?.trim() ||
  "https://oasis-baklawa-central-omgfjj6e3-oasisbaklawa2006-6222s-projects.vercel.app";
const srcJsonl = path.join(ROOT, "test-results/ai-uat-evidence.jsonl");
const destJsonl = path.join(ROOT, "docs/uat-crawl/UAT_POST_MERGE_493_PROOF.jsonl");
const destSummary = path.join(ROOT, "docs/uat-crawl/UAT_POST_MERGE_493_SUMMARY.json");
const destReport = path.join(ROOT, "docs/uat-crawl/UAT_POST_MERGE_493_REPORT.md");

if (!append && fs.existsSync(destJsonl)) {
  // Preserve prior rows on first write of a run — only init if missing
} else if (!append) {
  fs.mkdirSync(path.dirname(destJsonl), { recursive: true });
}

const counts = { PASS: 0, FAIL: 0, BLOCKED: 0 };
const rows = [];

if (fs.existsSync(srcJsonl)) {
  for (const line of fs.readFileSync(srcJsonl, "utf8").split(/\r?\n/).filter(Boolean)) {
    let row;
    try {
      row = JSON.parse(line);
    } catch {
      continue;
    }
    if (row.status in counts) counts[row.status] += 1;
    rows.push(row.uat_id);
    const out = {
      proof: "post-merge-493-security",
      uatId: row.uat_id,
      runId: RUN_ID,
      prHeadSha: DEPLOY_SHA,
      mergeSha: MERGE_SHA,
      githubDeploymentId: DEPLOY_ID,
      crawlBaseUrl: BASE_URL,
      status: row.status,
      role: row.role,
      finalUrl: row.final_url,
      actual: row.actual,
      severity: row.severity,
      timestamp: row.generated_at || new Date().toISOString(),
      notCurrentMainCertification: true,
      preservesPriorFailEvidence: true,
    };
    fs.mkdirSync(path.dirname(destJsonl), { recursive: true });
    fs.appendFileSync(destJsonl, `${JSON.stringify(out)}\n`, "utf8");
  }
}

if (fs.existsSync(path.join(ROOT, "test-results/APPVERSE_AI_UAT_REPORT.md"))) {
  fs.mkdirSync(path.dirname(destReport), { recursive: true });
  fs.copyFileSync(path.join(ROOT, "test-results/APPVERSE_AI_UAT_REPORT.md"), destReport);
}

fs.writeFileSync(
  destSummary,
  `${JSON.stringify(
    {
      generatedAt: new Date().toISOString(),
      runId: RUN_ID,
      prHeadSha: DEPLOY_SHA,
      mergeSha: MERGE_SHA,
      githubDeploymentId: DEPLOY_ID,
      vercelDeploymentId: "BCyAHAee6qn7rg2Cjop91pYaGK93",
      crawlBaseUrl: BASE_URL,
      counts,
      uatIds: rows,
      label: "#493 security regression proof ONLY — NOT current-main certification",
      currentMainHoldSha: "64a107dfc167be76673a3d18f177a72472dcb241",
    },
    null,
    2,
  )}\n`,
  "utf8",
);

console.log(`Archived #493 proof: ${JSON.stringify(counts)} uatIds=${rows.join(",")}`);
