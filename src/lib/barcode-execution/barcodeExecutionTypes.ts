/** Phase 3C — barcode execution and scan verification domain types. */

export const SCAN_TYPES = [
  "order",
  "carton",
  "department_handoff",
  "ready_goods_intake",
  "dispatch_gate",
  "assembly_handoff",
] as const;

export type ScanType = (typeof SCAN_TYPES)[number];

export const VERIFICATION_TYPES = [
  "identity_match",
  "gate_check",
  "handoff_check",
  "intake_check",
] as const;

export type VerificationType = (typeof VERIFICATION_TYPES)[number];

export const SCAN_VERIFICATION_STATUSES = [
  "scanned",
  "verified",
  "mismatch",
  "duplicate",
  "rejected",
  "escalated",
] as const;

export type ScanVerificationStatus = (typeof SCAN_VERIFICATION_STATUSES)[number];

export interface ScanExecutionContext {
  correlationId: string;
  actorUserId: string;
  actorRole: string;
  actorDepartment?: string | null;
  idempotencyKey?: string | null;
  scanSource?: string;
  scanDeviceId?: string | null;
}

export interface BaseScanVerifyInput {
  entityType: string;
  entityId: string;
  orderId?: string | null;
  queueItemId?: string | null;
  barcodeValue: string;
  expectedBarcode?: string | null;
  photoEvidenceUrl?: string | null;
  metadata?: Record<string, unknown>;
}

export interface ScanRecordResult {
  scanId: string;
  verificationStatus: ScanVerificationStatus;
  eventId: string;
  mismatchReason: string | null;
  duplicateOfScanId: string | null;
}

export type OperationalScanRecord = {
  id: string;
  scanType: ScanType;
  verificationType: VerificationType;
  entityType: string;
  entityId: string;
  orderId: string | null;
  queueItemId: string | null;
  barcodeValue: string;
  expectedBarcode: string | null;
  verificationStatus: ScanVerificationStatus;
  mismatchReason: string | null;
  scanSource: string;
  scanDeviceId: string | null;
  actorId: string | null;
  actorRole: string | null;
  actorDepartment: string | null;
  photoEvidenceUrl: string | null;
  metadata: Record<string, unknown>;
  correlationId: string;
  idempotencyKey: string | null;
  createdAt: string;
};

export type ScanRow = {
  id: string;
  scan_type: string;
  verification_type: string;
  entity_type: string;
  entity_id: string;
  order_id: string | null;
  queue_item_id: string | null;
  barcode_value: string;
  expected_barcode: string | null;
  verification_status: string;
  mismatch_reason: string | null;
  scan_source: string;
  scan_device_id: string | null;
  actor_id: string | null;
  actor_role: string | null;
  actor_department: string | null;
  photo_evidence_url: string | null;
  metadata: Record<string, unknown>;
  correlation_id: string;
  idempotency_key: string | null;
  created_at: string;
};

export function mapScanRow(row: ScanRow): OperationalScanRecord {
  return {
    id: row.id,
    scanType: row.scan_type as ScanType,
    verificationType: row.verification_type as VerificationType,
    entityType: row.entity_type,
    entityId: row.entity_id,
    orderId: row.order_id,
    queueItemId: row.queue_item_id,
    barcodeValue: row.barcode_value,
    expectedBarcode: row.expected_barcode,
    verificationStatus: row.verification_status as ScanVerificationStatus,
    mismatchReason: row.mismatch_reason,
    scanSource: row.scan_source,
    scanDeviceId: row.scan_device_id,
    actorId: row.actor_id,
    actorRole: row.actor_role,
    actorDepartment: row.actor_department,
    photoEvidenceUrl: row.photo_evidence_url,
    metadata: row.metadata ?? {},
    correlationId: row.correlation_id,
    idempotencyKey: row.idempotency_key,
    createdAt: row.created_at,
  };
}
