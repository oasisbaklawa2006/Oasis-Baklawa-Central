#!/usr/bin/env node
import fs from "node:fs";
import {
  displayUrlForReport,
  ensureProviderPreviewOutputDir,
  escapeMarkdownTableCell,
  readManifestJsonl,
  resolveProviderPreviewOutputFile,
} from "./lib/provider-preview-report-lib.mjs";

const rows = readManifestJsonl();
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

ensureProviderPreviewOutputDir();
const summaryPath = resolveProviderPreviewOutputFile("PROVIDER_PREVIEW_UAT_SUMMARY.json");
const reportPath = resolveProviderPreviewOutputFile("PROVIDER_PREVIEW_UAT_REPORT.md");

fs.writeFileSync(summaryPath, `${JSON.stringify(summary, null, 2)}\n`);

let md = "# Provider-preview UAT (AI Studio + Trace)\n\n";
md += `Generated: ${summary.generatedAt}  \n`;
md += `Rows: ${summary.rowCount}  \n\n`;
md += "| UAT | App | Route | Visual | Function | Scanner gate | Notes |\n";
md += "| --- | --- | --- | --- | --- | --- | --- |\n";
for (const row of rows) {
  md += `| ${escapeMarkdownTableCell(row.uatId, 80)} | ${escapeMarkdownTableCell(row.app, 40)} | ${escapeMarkdownTableCell(row.route, 80)} | ${escapeMarkdownTableCell(row.visualStatus, 20)} | ${escapeMarkdownTableCell(row.functionStatus, 20)} | ${escapeMarkdownTableCell(row.scannerAcceptanceStatus, 40)} | ${escapeMarkdownTableCell(row.notes, 120)} |\n`;
}
md += "\n## Deploy provenance (redacted)\n\n";
const bases = [...new Set(rows.map((r) => displayUrlForReport(r.crawlBaseUrl)).filter(Boolean))];
for (const base of bases) {
  md += `- ${escapeMarkdownTableCell(base, 300)}\n`;
}

fs.writeFileSync(reportPath, md);
console.log(`Wrote ${reportPath} and ${summaryPath}`);
