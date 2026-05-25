import type {
  DispatchCompletionEvidenceRecord,
  DispatchCompletionEvidenceStatus,
  DispatchCompletionEvidenceType,
  DispatchCompletionStatus,
} from "./dispatchCompletionTypes";
import { DispatchCompletionError } from "./dispatchCompletionTypes";

export function validateCompletionEvidenceInsert(
  row: Pick<
    DispatchCompletionEvidenceRecord,
    "evidenceType" | "evidenceStatus" | "completionStatus" | "orderId" | "correlationId"
  >,
): void {
  if (!row.orderId?.trim()) throw new Error("dispatch_completion_evidence requires order_id");
  if (!row.correlationId?.trim()) throw new Error("dispatch_completion_evidence requires correlation_id");

  const types: DispatchCompletionEvidenceType[] = [
    "completion_review",
    "completion_attestation",
    "completion_hold",
    "completion_hold_release",
    "supervisor_override",
  ];
  if (!types.includes(row.evidenceType)) {
    throw new Error(`Invalid completion evidence_type: ${row.evidenceType}`);
  }

  const statuses: DispatchCompletionEvidenceStatus[] = [
    "pending",
    "verified",
    "rejected",
    "blocked",
    "released",
  ];
  if (!statuses.includes(row.evidenceStatus)) {
    throw new Error(`Invalid completion evidence_status: ${row.evidenceStatus}`);
  }

  const completionStatuses: DispatchCompletionStatus[] = [
    "not_eligible",
    "prerequisites_pending",
    "completion_eligible",
    "completion_attested",
    "completion_blocked",
    "already_dispatched",
  ];
  if (!completionStatuses.includes(row.completionStatus)) {
    throw new Error(`Invalid completion_status: ${row.completionStatus}`);
  }
}

export function requireAttestationReason(reason: string | null | undefined): string {
  const trimmed = reason?.trim();
  if (!trimmed) {
    throw new DispatchCompletionError("reason_required", "completion attestation requires attestationReason");
  }
  return trimmed;
}
