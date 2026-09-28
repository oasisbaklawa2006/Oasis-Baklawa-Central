#!/usr/bin/env node
/**
 * Shared helpers for provider-preview evidence merge (plain ESM for Node scripts).
 */
import fs from "node:fs";
import path from "node:path";

const OUTPUT_SEGMENTS = ["test-results", "provider-preview-uat"];

const ALLOWED_OUTPUT_FILES = new Set([
  "UAT_MANIFEST_PROVIDER_PREVIEW.jsonl",
  "PROVIDER_PREVIEW_UAT_SUMMARY.json",
  "PROVIDER_PREVIEW_UAT_REPORT.md",
  "UAT_SECRET_PRESENCE.json",
]);

export function resolveProviderPreviewOutputRoot(cwd = process.cwd()) {
  const root = path.resolve(cwd, ...OUTPUT_SEGMENTS);
  const segments = root.split(path.sep).filter(Boolean);
  if (segments.at(-2) !== "test-results" || segments.at(-1) !== "provider-preview-uat") {
    throw new Error("Provider-preview output root is outside the governed directory.");
  }
  return root;
}

export function resolveProviderPreviewOutputFile(fileName, cwd = process.cwd()) {
  if (!ALLOWED_OUTPUT_FILES.has(fileName)) {
    throw new Error(`Disallowed provider-preview output file: ${fileName}`);
  }
  const root = resolveProviderPreviewOutputRoot(cwd);
  const full = path.resolve(root, fileName);
  if (!full.startsWith(`${root}${path.sep}`) && full !== root) {
    throw new Error("Resolved output path escapes the provider-preview directory.");
  }
  return full;
}

export function ensureProviderPreviewOutputDir(cwd = process.cwd()) {
  const root = resolveProviderPreviewOutputRoot(cwd);
  fs.mkdirSync(root, { recursive: true });
  return root;
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

export function readManifestJsonl(cwd = process.cwd()) {
  const manifestPath = resolveProviderPreviewOutputFile("UAT_MANIFEST_PROVIDER_PREVIEW.jsonl", cwd);
  if (!fs.existsSync(manifestPath)) return [];
  const lines = fs.readFileSync(manifestPath, "utf8").split(/\r?\n/).filter(Boolean);
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
