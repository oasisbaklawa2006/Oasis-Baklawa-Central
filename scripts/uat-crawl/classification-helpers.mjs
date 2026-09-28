/** Shared fail-closed UAT gate classifications (harness-only; values never logged). */
import fs from "node:fs";
import path from "node:path";

export const DATA_FIXTURE_GATE = "DATA_FIXTURE_GATE";
export const TEST_CREDENTIAL_GATE = "TEST_CREDENTIAL_GATE";

const POST_FIX_483_MANIFEST = path.resolve(
  import.meta.dirname,
  "../../docs/uat-crawl/UAT_MANIFEST_POST_FIX_483.jsonl",
);

const FIXTURE_MISS_MARKERS = [
  "Could not open pending review sheet",
  "no pending apps",
  "selector miss",
];

export function isDataFixtureGateRow(row) {
  if (row?.blockClassification === DATA_FIXTURE_GATE) return true;
  if (row?.authenticated !== true) return false;
  if (!row?.uxEvidence?.s0) return false;
  if (row?.uxEvidence?.s3) return false;
  const notes = String(row.notes ?? "");
  return FIXTURE_MISS_MARKERS.some((marker) => notes.includes(marker));
}

export function loadDataFixtureGateById(runId) {
  const map = new Map();
  if (!fs.existsSync(POST_FIX_483_MANIFEST)) return map;
  for (const line of fs.readFileSync(POST_FIX_483_MANIFEST, "utf8").trim().split("\n")) {
    if (!line) continue;
    let row;
    try {
      row = JSON.parse(line);
    } catch {
      continue;
    }
    if (row.runId !== runId) continue;
    if (isDataFixtureGateRow(row)) map.set(row.uatId, row);
  }
  return map;
}

export function inferTestCredentialGate(row) {
  if (row?.blockClassification === TEST_CREDENTIAL_GATE) return TEST_CREDENTIAL_GATE;
  if (row?.authenticated) return null;
  const missing = row?.missingSecretNames ?? [];
  if (missing.length > 0) return null;
  const prefix = row?.credentialPrefix;
  if (!prefix) return null;
  const haystack = [...(row.networkErrors ?? []), ...(row.consoleErrors ?? [])].join(" ");
  if (
    row.blockClassification === "AUTH_FLOW_FAILED" &&
    ((haystack.includes("400") && haystack.includes("auth/v1/token")) ||
      haystack.includes("SESSION_CREATE_FAILED"))
  ) {
    return TEST_CREDENTIAL_GATE;
  }
  return null;
}
