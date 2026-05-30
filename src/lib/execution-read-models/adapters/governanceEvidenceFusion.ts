import type { FinanceDispatchSignal } from "@/lib/dispatch-readiness/financeDispatchSignal";
import type { DispatchReadinessStatus } from "@/lib/dispatch-readiness/dispatchReadinessTypes";
import type { DispatchCompletionStatus } from "@/lib/dispatch-completion/dispatchCompletionTypes";
import type { FinanceReleaseStatus } from "@/lib/finance-governance/financeGovernanceTypes";
import { projectFinanceRelease } from "@/lib/finance-governance/financeReleaseEligibility";
import type { FinanceGovernanceInput } from "@/lib/finance-governance/financeGovernanceTypes";

export interface ReadinessEvidenceSlice {
  evidenceType: string;
  evidenceStatus: string;
  evidenceRef?: string | null;
  createdAt: string;
}

export interface CompletionEvidenceSlice {
  evidenceType: string;
  evidenceStatus: string;
  evidenceRef?: string | null;
  createdAt: string;
}

export interface ScanBarcodeSlice {
  scanType: string;
  verificationStatus: string;
  barcodeValue: string | null;
}

/** Gate eligibility for finance/completion/finalization — derived from append-only readiness evidence. */
export function isGateEligibleFromReadinessEvidence(evidence: ReadinessEvidenceSlice[]): boolean {
  return evidence.some(
    (e) =>
      e.evidenceStatus === "verified" &&
      (e.evidenceType === "manual_readiness_review" || e.evidenceType === "gate_scan"),
  );
}

export function deriveReadinessStatusFromEvidence(
  evidence: ReadinessEvidenceSlice[],
): DispatchReadinessStatus {
  if (isGateEligibleFromReadinessEvidence(evidence)) {
    return "gate_eligible";
  }
  if (evidence.some((e) => e.evidenceType === "manual_readiness_review" && e.evidenceStatus === "pending")) {
    return "ready_for_review";
  }
  if (evidence.length > 0) {
    return "partially_ready";
  }
  return "not_ready";
}

export function deriveFinanceReleaseStatusFromInput(
  input: FinanceGovernanceInput,
): FinanceReleaseStatus {
  return projectFinanceRelease(input).releaseStatus;
}

export function deriveCompletionStatusFromEvidence(
  evidence: CompletionEvidenceSlice[],
  orderStatus: string,
): DispatchCompletionStatus {
  if (orderStatus === "dispatched" || orderStatus === "in_transit" || orderStatus === "delivered") {
    return "already_dispatched";
  }
  const attested = evidence.some(
    (e) => e.evidenceType === "completion_attestation" && e.evidenceStatus === "verified",
  );
  if (attested) return "completion_attested";
  return "prerequisites_pending";
}

export function resolveGateReferenceFromSlices(
  readinessEvidence: ReadinessEvidenceSlice[],
  scans: ScanBarcodeSlice[],
): string | null {
  const gateEvidence = readinessEvidence.find(
    (e) => e.evidenceType === "gate_scan" && e.evidenceStatus === "verified" && e.evidenceRef?.trim(),
  );
  if (gateEvidence?.evidenceRef?.trim()) return gateEvidence.evidenceRef.trim();

  const verifiedGateScan = scans.find(
    (s) => s.scanType === "dispatch_gate" && s.verificationStatus === "verified" && s.barcodeValue?.trim(),
  );
  if (verifiedGateScan?.barcodeValue?.trim()) return verifiedGateScan.barcodeValue.trim();

  const readinessRef = readinessEvidence.find(
    (e) => e.evidenceType === "manual_readiness_review" && e.evidenceStatus === "verified" && e.evidenceRef?.trim(),
  );
  return readinessRef?.evidenceRef?.trim() ?? null;
}

export function resolveCompletionReferenceFromEvidence(
  evidence: CompletionEvidenceSlice[],
): string | null {
  const attestation = evidence.find(
    (e) => e.evidenceType === "completion_attestation" && e.evidenceStatus === "verified",
  );
  if (attestation?.evidenceRef?.trim()) return attestation.evidenceRef.trim();

  const review = evidence.find(
    (e) => e.evidenceType === "completion_review" && e.evidenceStatus === "verified" && e.evidenceRef?.trim(),
  );
  return review?.evidenceRef?.trim() ?? null;
}

export function resolveTransporterReference(
  lineageTransporter: string | null,
  gateReference: string | null,
  completionReference: string | null,
): string | null {
  if (lineageTransporter?.trim()) return lineageTransporter.trim();
  if (gateReference?.trim()) return `HANDOFF-${gateReference.trim()}`;
  if (completionReference?.trim()) return `HANDOFF-${completionReference.trim().slice(0, 32)}`;
  return null;
}

export function financeSignalForFinalization(signal: FinanceDispatchSignal): FinanceDispatchSignal {
  return signal === "unknown" ? "blocked" : signal;
}
