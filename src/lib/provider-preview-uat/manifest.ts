import { createHash } from "node:crypto";
import { appendFileSync, mkdirSync, readFileSync } from "node:fs";
import path from "node:path";
import type { ProviderPreviewTarget } from "./catalogue";
import { PROVIDER_PREVIEW_TRANCHE } from "./catalogue";
import type { FunctionStatus, ScannerAcceptanceStatus, VisualStatus } from "./gates";
import { redactUrlForEvidence } from "./url";

export type UxEvidenceSlot = "s0" | "s1" | "s2" | "s3";

export type UxEvidence = Record<UxEvidenceSlot, string | null>;

export type ProviderPreviewManifestRow = {
  uatId: string;
  tranche: string;
  harness: "provider-preview";
  app: string;
  route: string;
  state: string;
  role: string;
  viewport: string;
  device: string;
  baselineSha: string;
  crawlBaseUrl: string;
  timestamp: string;
  runId?: string;
  runAttempt?: string;
  runTranche?: string;
  targetMainSha?: string;
  blockClassification?: string | null;
  visualStatus: VisualStatus;
  functionStatus: FunctionStatus;
  scannerAcceptanceStatus: ScannerAcceptanceStatus;
  uxEvidence: UxEvidence;
  uxEvidenceSha256: Partial<Record<UxEvidenceSlot, string>>;
  consoleErrors: string[];
  networkErrors: string[];
  notes: string;
  screenshotPrimary: string;
  screenshotSha256: string;
};

export const DEFAULT_MANIFEST_PATH = path.join(
  "test-results",
  "provider-preview-uat",
  "UAT_MANIFEST_PROVIDER_PREVIEW.jsonl",
);

export function emptyUxEvidence(): UxEvidence {
  return { s0: null, s1: null, s2: null, s3: null };
}

export function sha256File(filePath: string): string {
  const buf = readFileSync(filePath);
  return createHash("sha256").update(buf).digest("hex");
}

export function attachRunMetadata(row: ProviderPreviewManifestRow): ProviderPreviewManifestRow {
  return {
    ...row,
    runId: process.env.GITHUB_RUN_ID?.trim() || row.runId || "local",
    runAttempt: process.env.GITHUB_RUN_ATTEMPT?.trim() || row.runAttempt || "1",
    runTranche: process.env.PROVIDER_PREVIEW_TRANCHE?.trim() || row.runTranche || PROVIDER_PREVIEW_TRANCHE,
    targetMainSha:
      process.env.UAT_TARGET_SHA?.trim() ||
      process.env.PROVIDER_PREVIEW_CENTRAL_MAIN_SHA?.trim() ||
      row.targetMainSha ||
      "",
  };
}

export function appendManifestRow(
  row: ProviderPreviewManifestRow,
  manifestPath = DEFAULT_MANIFEST_PATH,
): void {
  const dir = path.dirname(manifestPath);
  mkdirSync(dir, { recursive: true });
  const sanitized: ProviderPreviewManifestRow = {
    ...attachRunMetadata(row),
    crawlBaseUrl: redactUrlForEvidence(row.crawlBaseUrl),
  };
  appendFileSync(manifestPath, `${JSON.stringify(sanitized)}\n`, "utf8");
}

export function slugRoute(route: string): string {
  return (
    route
      .replace(/^\//, "")
      .replace(/\//g, "-")
      .replace(/[^a-zA-Z0-9_-]/g, "-")
      .replace(/-+/g, "-") || "root"
  );
}

export function screenshotRelPath(target: ProviderPreviewTarget, slot: UxEvidenceSlot): string {
  const routeSlug = slugRoute(target.route);
  const stateSlug = target.state.replace(/[^a-zA-Z0-9_-]/g, "-");
  return `provider-preview-uat/screenshots/${target.uatId}/${target.app}-${routeSlug}-${stateSlug}-${slot}.png`;
}
