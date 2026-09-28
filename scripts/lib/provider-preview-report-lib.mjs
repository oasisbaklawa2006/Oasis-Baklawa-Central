#!/usr/bin/env node
/**
 * Shared helpers for provider-preview evidence merge (plain ESM for Node scripts).
 * Runtime filesystem I/O is deliberately pinned to literal repository-relative
 * paths so static analysis can prove there is no path-injection surface.
 */
import fs from "node:fs";
import path from "node:path";

const MANIFEST_FILE = "UAT_MANIFEST_PROVIDER_PREVIEW.jsonl";
const SUMMARY_FILE = "PROVIDER_PREVIEW_UAT_SUMMARY.json";
const REPORT_FILE = "PROVIDER_PREVIEW_UAT_REPORT.md";
const SECRET_PRESENCE_FILE = "UAT_SECRET_PRESENCE.json";

function governedOutputRoot(cwd = process.cwd()) {
  return path.resolve(cwd, "test-results", "provider-preview-uat");
}

function assertGovernedOutputRoot(root) {
  const segments = root.split(path.sep).filter(Boolean);
  if (segments.at(-2) !== "test-results" || segments.at(-1) !== "provider-preview-uat") {
    throw new Error("Provider-preview output root is outside the governed directory.");
  }
}

export function resolveProviderPreviewOutputRoot(cwd = process.cwd()) {
  const root = governedOutputRoot(cwd);
  assertGovernedOutputRoot(root);
  return root;
}

export function resolveProviderPreviewOutputFile(fileName, cwd = process.cwd()) {
  const allowed = new Set([MANIFEST_FILE, SUMMARY_FILE, REPORT_FILE, SECRET_PRESENCE_FILE]);
  if (!allowed.has(fileName)) {
    throw new Error(`Disallowed provider-preview output file: ${fileName}`);
  }
  const root = resolveProviderPreviewOutputRoot(cwd);
  const full = path.resolve(root, fileName);
  if (!full.startsWith(`${root}${path.sep}`)) {
    throw new Error("Resolved output path escapes the provider-preview directory.");
  }
  return full;
}

export function ensureProviderPreviewOutputDir() {
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
  fs.mkdirSync("test-results/provider-preview-uat", { recursive: true });
  fs.writeFileSync("test-results/provider-preview-uat/PROVIDER_PREVIEW_UAT_SUMMARY.json", jsonText);
}

export function writeProviderPreviewReport(markdownText) {
  fs.mkdirSync("test-results/provider-preview-uat", { recursive: true });
  fs.writeFileSync("test-results/provider-preview-uat/PROVIDER_PREVIEW_UAT_REPORT.md", markdownText);
}

export function writeSecretPresenceAudit(jsonText) {
  fs.mkdirSync("test-results/provider-preview-uat", { recursive: true });
  fs.writeFileSync("test-results/provider-preview-uat/UAT_SECRET_PRESENCE.json", jsonText);
}

export function appendManifestLine(line) {
  fs.mkdirSync("test-results/provider-preview-uat", { recursive: true });
  fs.appendFileSync("test-results/provider-preview-uat/UAT_MANIFEST_PROVIDER_PREVIEW.jsonl", line);
}
