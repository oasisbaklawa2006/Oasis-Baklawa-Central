/** Shared fail-closed UAT gate classifications (harness-only; values never logged). */
import fs from "node:fs";
import path from "node:path";

export const DATA_FIXTURE_GATE = "DATA_FIXTURE_GATE";
export const TEST_CREDENTIAL_GATE = "TEST_CREDENTIAL_GATE";

const POST_FIX_483_MANIFEST = path.resolve(
  import.meta.dirname,
  "../../docs/uat-crawl/UAT_MANIFEST_POST_FIX_483.jsonl",
);
const AUTH_MANIFEST = path.resolve(import.meta.dirname, "../../docs/uat-crawl/UAT_MANIFEST_AUTH.jsonl");
const BUYER_MOBILE_MANIFEST = path.resolve(
  import.meta.dirname,
  "../../docs/uat-crawl/UAT_MANIFEST_BUYER_MOBILE.jsonl",
);
const AI_UAT_MANIFEST = path.resolve(import.meta.dirname, "../../docs/uat-crawl/UAT_MANIFEST_AI_UAT.jsonl");

const AUTH_GATE_CLASSIFICATIONS = new Set([
  "MISSING_SECRET",
  "AUTH_FLOW_FAILED",
  "AUTH_CONTRACT_MISMATCH",
  "PROVIDER_GATED",
  "OTP_EXTERNAL_GATE",
  "APPLICATION_FAIL",
  "NOT_EXECUTED",
  DATA_FIXTURE_GATE,
  TEST_CREDENTIAL_GATE,
]);

const FIXTURE_MISS_MARKERS = [
  "Could not open pending review sheet",
  "no pending apps",
  "selector miss",
];

const UAT_ID_PATTERN = /^UAT-\d{4}$/;

function isGovernedUatId(value) {
  return typeof value === "string" && UAT_ID_PATTERN.test(value);
}

function readPostFix483Rows() {
  if (!fs.existsSync(POST_FIX_483_MANIFEST)) return [];
  const rows = [];
  for (const line of fs.readFileSync(POST_FIX_483_MANIFEST, "utf8").trim().split("\n")) {
    if (!line) continue;
    try {
      rows.push(JSON.parse(line));
    } catch {
      continue;
    }
  }
  return rows;
}

function readAuthManifestRows() {
  if (!fs.existsSync(AUTH_MANIFEST)) return [];
  const rows = [];
  for (const line of fs.readFileSync(AUTH_MANIFEST, "utf8").trim().split("\n")) {
    if (!line) continue;
    try {
      rows.push(JSON.parse(line));
    } catch {
      continue;
    }
  }
  return rows;
}

function readBuyerMobileManifestRows() {
  if (!fs.existsSync(BUYER_MOBILE_MANIFEST)) return [];
  const rows = [];
  for (const line of fs.readFileSync(BUYER_MOBILE_MANIFEST, "utf8").trim().split("\n")) {
    if (!line) continue;
    try {
      rows.push(JSON.parse(line));
    } catch {
      continue;
    }
  }
  return rows;
}

function readAiUatManifestRows() {
  if (!fs.existsSync(AI_UAT_MANIFEST)) return [];
  const rows = [];
  for (const line of fs.readFileSync(AI_UAT_MANIFEST, "utf8").trim().split("\n")) {
    if (!line) continue;
    try {
      rows.push(JSON.parse(line));
    } catch {
      continue;
    }
  }
  return rows;
}

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
  for (const row of readPostFix483Rows()) {
    if (row.runId !== runId) continue;
    if (!isGovernedUatId(row.uatId)) continue;
    if (isDataFixtureGateRow(row)) map.set(row.uatId, row);
  }
  return map;
}

export function inferTestCredentialGate(row) {
  if (row?.blockClassification === TEST_CREDENTIAL_GATE) return TEST_CREDENTIAL_GATE;
  if (row?.authenticated) return null;
  const missing = row?.missingSecretNames ?? [];
  if (missing.length > 0) return null;
  if (!row?.credentialPrefix) return null;
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

function inferAuthGateFromNotes(row) {
  const notes = String(row.notes ?? "");
  if (row.visualStatus === "NOT_EXECUTED") return "NOT_EXECUTED";
  if (notes.includes("OTP") || notes.includes("MSG91") || notes.toLowerCase().includes("provider")) {
    return "OTP_EXTERNAL_GATE";
  }
  if (notes.includes("Welcome Back") || notes.includes("contract mismatch") || notes.includes("AUTH_CONTRACT")) {
    return "AUTH_CONTRACT_MISMATCH";
  }
  if (notes.includes("LOGIN FAILED") || notes.includes("AUTH_FLOW") || notes.toLowerCase().includes("still on login")) {
    return "AUTH_FLOW_FAILED";
  }
  return null;
}

function applyAuthManifestRowToMapping(mapping, row, runId) {
  if (row.runId !== runId || row.authenticated || !isGovernedUatId(row.uatId)) return;
  const testCred = inferTestCredentialGate(row);
  if (testCred) {
    mapping.set(row.uatId, testCred);
    return;
  }
  const classification = row.blockClassification;
  if (classification && AUTH_GATE_CLASSIFICATIONS.has(classification)) {
    mapping.set(row.uatId, classification);
    return;
  }
  const inferred = inferAuthGateFromNotes(row);
  if (inferred) mapping.set(row.uatId, inferred);
}

export function loadAuthGateById(runId) {
  const mapping = new Map();
  for (const row of readPostFix483Rows()) {
    if (row.runId !== runId || !isGovernedUatId(row.uatId)) continue;
    if (isDataFixtureGateRow(row)) mapping.set(row.uatId, DATA_FIXTURE_GATE);
  }
  for (const row of readAuthManifestRows()) {
    applyAuthManifestRowToMapping(mapping, row, runId);
  }
  for (const row of readBuyerMobileManifestRows()) {
    applyAuthManifestRowToMapping(mapping, row, runId);
  }
  for (const row of readAiUatManifestRows()) {
    applyAuthManifestRowToMapping(mapping, row, runId);
  }
  return mapping;
}
