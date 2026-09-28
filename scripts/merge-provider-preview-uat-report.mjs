#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";

const RESULT_DIR = path.join("test-results", "provider-preview-uat");
const MANIFEST = path.join(RESULT_DIR, "UAT_MANIFEST_PROVIDER_PREVIEW.jsonl");
const REPORT = path.join(RESULT_DIR, "PROVIDER_PREVIEW_UAT_REPORT.md");
const SUMMARY = path.join(RESULT_DIR, "PROVIDER_PREVIEW_UAT_SUMMARY.json");

function displayUrl(value) {
  const raw = String(value ?? "").trim();
  if (!raw) return "";
  try {
    const url = new URL(raw);
    return `${url.origin}${url.pathname}`;
  } catch {
    return "invalid URL";
  }
}

function loadRows() {
  if (!fs.existsSync(MANIFEST)) return [];
  return fs
    .readFileSync(MANIFEST, "utf8")
    .split(/\r?\n/)
    .filter(Boolean)
    .map((line) => JSON.parse(line));
}

const rows = loadRows();
const summary = {
  generatedAt: new Date().toISOString(),
  harness: "provider-preview",
  rowCount: rows.length,
  visual: { OBSERVED: 0, BLOCKED: 0, "NOT-TESTED": 0, FAIL: 0 },
  function: { OBSERVED: 0, BLOCKED: 0, "NOT-TESTED": 0, FAIL: 0 },
  scannerPhysicalGatePending: 0,
};

for (const row of rows) {
  if (summary.visual[row.visualStatus] !== undefined) summary.visual[row.visualStatus] += 1;
  if (summary.function[row.functionStatus] !== undefined) summary.function[row.functionStatus] += 1;
  if (row.scannerAcceptanceStatus === "PHYSICAL_GATE_PENDING") summary.scannerPhysicalGatePending += 1;
}

fs.mkdirSync(RESULT_DIR, { recursive: true });
fs.writeFileSync(SUMMARY, `${JSON.stringify(summary, null, 2)}\n`);

let md = "# Provider-preview UAT (AI Studio + Trace)\n\n";
md += `Generated: ${summary.generatedAt}  \n`;
md += `Rows: ${summary.rowCount}  \n\n`;
md += "| UAT | App | Route | Visual | Function | Scanner gate | Notes |\n";
md += "| --- | --- | --- | --- | --- | --- | --- |\n";
for (const row of rows) {
  md += `| ${row.uatId} | ${row.app} | ${row.route} | ${row.visualStatus} | ${row.functionStatus} | ${row.scannerAcceptanceStatus} | ${String(row.notes).replace(/\|/g, "\\|").slice(0, 120)} |\n`;
}
md += "\n## Deploy provenance (redacted)\n\n";
const bases = [...new Set(rows.map((r) => displayUrl(r.crawlBaseUrl)).filter(Boolean))];
for (const base of bases) {
  md += `- ${base}\n`;
}

fs.writeFileSync(REPORT, md);
console.log(`Wrote ${REPORT} and ${SUMMARY}`);
