/** Barcode App → Central scan ingest contract (HMAC-protected edge function). */

export const BARCODE_INGEST_SOURCE_APP = "barcode_app" as const;

export const BARCODE_INGEST_SCAN_TYPES = ["dispatch_gate", "carton"] as const;
export type BarcodeIngestScanType = (typeof BARCODE_INGEST_SCAN_TYPES)[number];

export const BARCODE_INGEST_VERIFICATION_TYPES = ["gate_check", "identity_match"] as const;
export type BarcodeIngestVerificationType = (typeof BARCODE_INGEST_VERIFICATION_TYPES)[number];

export const BARCODE_INGEST_VERIFICATION_STATUSES = ["verified"] as const;

export interface BarcodeScanPayload {
  source_app: typeof BARCODE_INGEST_SOURCE_APP;
  order_id: string;
  order_number: string;
  scan_type: BarcodeIngestScanType;
  verification_type: BarcodeIngestVerificationType;
  entity_type: "order";
  barcode_value: string;
  expected_barcode: string;
  verification_status: "verified";
  scan_source: string;
  barcode_app_reference?: string;
  submitted_at?: string;
}

export interface BarcodeScanIngestSuccessResponse {
  ok: true;
  scan_id: string;
  reference: string;
  message: string;
  duplicate?: false;
}

export interface BarcodeScanIngestDuplicateResponse {
  ok: true;
  duplicate: true;
  message: string;
}

export interface BarcodeScanIngestFailureResponse {
  ok: false;
  reason: string;
  message: string;
}

export type BarcodeScanIngestResponse =
  | BarcodeScanIngestSuccessResponse
  | BarcodeScanIngestDuplicateResponse
  | BarcodeScanIngestFailureResponse;

export interface BarcodeScanIngestHeaders {
  sourceApp: string;
  idempotencyKey: string;
  signature: string;
}

export const SCAN_TYPE_VERIFICATION_MAP: Record<
  BarcodeIngestScanType,
  BarcodeIngestVerificationType
> = {
  dispatch_gate: "gate_check",
  carton: "identity_match",
};
