#!/usr/bin/env node
/**
 * Shared helpers for provider-preview evidence merge (plain ESM for Node scripts).
 * Filesystem I/O uses fixed relative paths from repository root (Codacy-safe).
 */
import fs from "node:fs";
import path from "node:path";

const OUTPUT_REL = "test-results/provider-preview-uat";

function assertRepositoryRoot() {
  if (!fs.existsSync("package.json")) {
    throw new Error("Provider-preview harness must run from the repository root.");
  }
}

export function resolveProviderPreviewOutputRoot(cwd = process.cwd()) {
  return path.join(cwd, OUTPUT_REL);
}

export function resolveProviderPreviewOutputFile(fileName, cwd = process.cwd()) {
  const allowed = new Set([
    "UAT_MANIFEST_PROVIDER_PREVIEW.jsonl",
    "PROVIDER_PREVIEW_UAT_SUMMARY.json",
    "PROVIDER_PREVIEW_UAT_REPORT.md",
    "UAT_SECRET_PRESENCE.json",
  ]);
  if (!allowed.has(fileName)) {
    throw new Error(`Disallowed provider-preview output file: ${fileName}`);
  }
  const full = path.join(resolveProviderPreviewOutputRoot(cwd), fileName);
  const root = resolveProviderPreviewOutputRoot(cwd);
  if (!full.startsWith(`${root}${path.sep}`)) {
    throw new Error("Resolved output path escapes the provider-preview directory.");
  }
  return full;
}

export function ensureProviderPreviewOutputDir() {
  assertRepositoryRoot();
  fs.mkdirSync("test-results/provider-preview-uat", { recursive: true });
  return resolveProviderPreviewOutputRoot();
}

/** Escape untrusted manifest text before embedding in Markdown tables (CodeQL-safe). */
export function escapeMarkdownTableCell(value, maxLength = 120) {
  return String(value ?? "")
    .replace(/\\/g, "\\\\")
    .replace(/\|/g, "\\|")
    .replace(/[\r\n]+/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, maxLength);
}

/** Evidence-safe URL (origin + pathname only). */
export function displayUrlForReport(value) {
  const raw = String(value ?? "").trim();
  if (!raw) return "";
  try {
    const url = new URL(raw);
    return `${url.origin}${url.pathname}`;
  } catch {
    return "invalid URL";
  }
}

export function readManifestJsonl() {
  assertRepositoryRoot();
  if (!fs.existsSync("test-results/provider-preview-uat/UAT_MANIFEST_PROVIDER_PREVIEW.jsonl")) return [];
  const lines = fs
    .readFileSync("test-results/provider-preview-uat/UAT_MANIFEST_PROVIDER_PREVIEW.jsonl", "utf8")
    .split(/\r?\n/)
    .filter(Boolean);
  const rows = [];
  for (const line of lines) {
    try {
      rows.push(JSON.parse(line));
    } catch {
      rows.push({
        uatId: "evidence-stream",
        visualStatus: "BLOCKED",
        functionStatus: "BLOCKED",
        scannerAcceptanceStatus: "NOT_APPLICABLE",
        notes: "Malformed manifest JSONL line — skipped for report merge.",
      });
    }
  }
  return rows;
}

export function writeProviderPreviewSummary(jsonText) {
  assertRepositoryRoot();
  fs.mkdirSync("test-results/provider-preview-uat", { recursive: true });
  fs.writeFileSync("test-results/provider-preview-uat/PROVIDER_PREVIEW_UAT_SUMMARY.json", jsonText);
}

export function writeProviderPreviewReport(markdownText) {
  assertRepositoryRoot();
  fs.mkdirSync("test-results/provider-preview-uat", { recursive: true });
  fs.writeFileSync("test-results/provider-preview-uat/PROVIDER_PREVIEW_UAT_REPORT.md", markdownText);
}

export function writeSecretPresenceAudit(jsonText) {
  assertRepositoryRoot();
  fs.mkdirSync("test-results/provider-preview-uat", { recursive: true });
  fs.writeFileSync("test-results/provider-preview-uat/UAT_SECRET_PRESENCE.json", jsonText);
}

export function appendManifestLine(line) {
  assertRepositoryRoot();
  fs.mkdirSync("test-results/provider-preview-uat", { recursive: true });
  fs.appendFileSync("test-results/provider-preview-uat/UAT_MANIFEST_PROVIDER_PREVIEW.jsonl", line);
}
