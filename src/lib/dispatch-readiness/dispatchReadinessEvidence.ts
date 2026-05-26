import type {
  DispatchEvidenceRecord,
  DispatchEvidenceStatus,
  DispatchEvidenceType,
} from "./dispatchReadinessTypes";

export function validateEvidenceInsert(
  row: Pick<
    DispatchEvidenceRecord,
    "evidenceType" | "evidenceStatus" | "orderId" | "correlationId"
  >,
): void {
  if (!row.orderId?.trim()) throw new Error("dispatch_readiness_evidence requires order_id");
  if (!row.correlationId?.trim()) throw new Error("dispatch_readiness_evidence requires correlation_id");
  const types: DispatchEvidenceType[] = [
    "packing_photo",
    "carton_barcode",
    "gate_scan",
    "reservation_check",
    "finance_signal",
    "document_placeholder",
    "manual_readiness_review",
  ];
  if (!types.includes(row.evidenceType)) {
    throw new Error(`Invalid evidence_type: ${row.evidenceType}`);
  }
  const statuses: DispatchEvidenceStatus[] = ["pending", "verified", "rejected", "missing", "expired"];
  if (!statuses.includes(row.evidenceStatus)) {
    throw new Error(`Invalid evidence_status: ${row.evidenceStatus}`);
  }
}

export function evidenceSupportsReadiness(type: DispatchEvidenceType): boolean {
  return type === "packing_photo" || type === "gate_scan" || type === "carton_barcode";
}
