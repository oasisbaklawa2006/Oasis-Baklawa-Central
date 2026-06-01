import type { ReadinessEvidenceSlice } from "@/lib/execution-read-models/adapters/readinessSignalAdapter";
import type { ReadinessScanSlice } from "@/lib/execution-read-models/adapters/readinessSignalAdapter";

export function hasVerifiedReadinessEvidence(
  slices: ReadinessEvidenceSlice[],
  evidenceType: string,
): boolean {
  return slices.some((e) => e.evidenceType === evidenceType && e.evidenceStatus === "verified");
}

/** Packing, document, gate evidence rows plus operational gate + carton scans. */
export function isDispatchEvidencePrepared(
  evidenceSlices: ReadinessEvidenceSlice[],
  scan: ReadinessScanSlice,
): boolean {
  return (
    hasVerifiedReadinessEvidence(evidenceSlices, "packing_photo") &&
    hasVerifiedReadinessEvidence(evidenceSlices, "document_placeholder") &&
    hasVerifiedReadinessEvidence(evidenceSlices, "gate_scan") &&
    scan.gateScanVerified &&
    scan.cartonBarcodeVerified
  );
}

export function missingDispatchEvidenceLabels(
  evidenceSlices: ReadinessEvidenceSlice[],
  scan: ReadinessScanSlice,
): string[] {
  const missing: string[] = [];
  if (!hasVerifiedReadinessEvidence(evidenceSlices, "packing_photo")) {
    missing.push("Verified packing photo");
  }
  if (!hasVerifiedReadinessEvidence(evidenceSlices, "document_placeholder")) {
    missing.push("Verified document placeholder");
  }
  if (!hasVerifiedReadinessEvidence(evidenceSlices, "gate_scan")) {
    missing.push("Verified gate scan evidence");
  }
  if (!scan.gateScanVerified) {
    missing.push("Operational gate scan (dispatch_gate)");
  }
  if (!scan.cartonBarcodeVerified) {
    missing.push("Operational carton scan");
  }
  return missing;
}
