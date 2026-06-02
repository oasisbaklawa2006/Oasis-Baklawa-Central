import { validateCtnSoBarcode } from "./ctnSo.ts";
import {
  BARCODE_INGEST_SCAN_TYPES,
  BARCODE_INGEST_SOURCE_APP,
  BARCODE_INGEST_VERIFICATION_TYPES,
  type BarcodeScanIngestDuplicateResponse,
  type BarcodeScanIngestFailureResponse,
  type BarcodeScanIngestHeaders,
  type BarcodeScanIngestResponse,
  type BarcodeScanIngestSuccessResponse,
  type BarcodeScanPayload,
  SCAN_TYPE_VERIFICATION_MAP,
} from "./types.ts";

export interface IngestOrderRow {
  id: string;
  order_number: string;
}

export interface IngestScanRow {
  id: string;
  idempotency_key: string | null;
}

export interface InsertOperationalScanInput {
  scan_type: string;
  verification_type: string;
  entity_type: string;
  entity_id: string;
  order_id: string;
  barcode_value: string;
  expected_barcode: string;
  verification_status: string;
  scan_source: string;
  actor_role: string;
  metadata: Record<string, unknown>;
  correlation_id: string;
  idempotency_key: string;
}

export interface BarcodeScanIngestDb {
  findOrderById(orderId: string): Promise<IngestOrderRow | null>;
  findScanByIdempotencyKey(key: string): Promise<IngestScanRow | null>;
  insertScan(row: InsertOperationalScanInput): Promise<{ id: string }>;
}

export interface ProcessBarcodeScanIngestInput {
  headers: BarcodeScanIngestHeaders;
  payload: unknown;
  idempotencyKey: string;
  submittedAt: string;
  db: BarcodeScanIngestDb;
}

function failure(reason: string, message: string): BarcodeScanIngestFailureResponse {
  return { ok: false, reason, message };
}

function duplicate(): BarcodeScanIngestDuplicateResponse {
  return {
    ok: true,
    duplicate: true,
    message: "Scan already recorded",
  };
}

function success(scanId: string, reference: string): BarcodeScanIngestSuccessResponse {
  return {
    ok: true,
    scan_id: scanId,
    reference,
    message: "Scan recorded",
  };
}

export function validateIngestHeaders(headers: BarcodeScanIngestHeaders): BarcodeScanIngestFailureResponse | null {
  if (headers.sourceApp.trim().toLowerCase() !== BARCODE_INGEST_SOURCE_APP) {
    return failure("invalid_source_app", "X-Source-App must be barcode_app");
  }
  if (!headers.idempotencyKey.trim()) {
    return failure("missing_idempotency_key", "X-Idempotency-Key is required");
  }
  if (!headers.signature.trim()) {
    return failure("missing_signature", "X-Oasis-Signature is required");
  }
  return null;
}

export function parseBarcodeScanPayload(raw: unknown): BarcodeScanPayload | BarcodeScanIngestFailureResponse {
  if (!raw || typeof raw !== "object") {
    return failure("invalid_payload", "Request body must be a JSON object");
  }
  const body = raw as Record<string, unknown>;
  const requiredStringFields = [
    "source_app",
    "order_id",
    "order_number",
    "scan_type",
    "verification_type",
    "entity_type",
    "barcode_value",
    "expected_barcode",
    "verification_status",
    "scan_source",
  ] as const;

  for (const field of requiredStringFields) {
    if (typeof body[field] !== "string" || !String(body[field]).trim()) {
      return failure("invalid_payload", `${field} is required`);
    }
  }

  return {
    source_app: body.source_app as BarcodeScanPayload["source_app"],
    order_id: String(body.order_id).trim(),
    order_number: String(body.order_number).trim(),
    scan_type: body.scan_type as BarcodeScanPayload["scan_type"],
    verification_type: body.verification_type as BarcodeScanPayload["verification_type"],
    entity_type: "order",
    barcode_value: String(body.barcode_value).trim(),
    expected_barcode: String(body.expected_barcode).trim(),
    verification_status: body.verification_status as BarcodeScanPayload["verification_status"],
    scan_source: String(body.scan_source).trim(),
    barcode_app_reference:
      typeof body.barcode_app_reference === "string" ? body.barcode_app_reference.trim() : undefined,
    submitted_at: typeof body.submitted_at === "string" ? body.submitted_at.trim() : undefined,
  };
}

export function validateBarcodeScanBusinessRules(
  payload: BarcodeScanPayload,
): BarcodeScanIngestFailureResponse | null {
  if (payload.source_app !== BARCODE_INGEST_SOURCE_APP) {
    return failure("invalid_source_app", "source_app must be barcode_app");
  }
  if (payload.verification_status !== "verified") {
    return failure("unverified_payload", "verification_status must be verified");
  }
  if (!payload.order_id.trim()) {
    return failure("missing_order_id", "order_id is required");
  }
  if (!payload.order_number.trim()) {
    return failure("missing_order_number", "order_number is required");
  }
  if (payload.entity_type !== "order") {
    return failure("invalid_entity_type", "entity_type must be order");
  }
  if (!(BARCODE_INGEST_SCAN_TYPES as readonly string[]).includes(payload.scan_type)) {
    return failure("invalid_scan_type", "scan_type must be dispatch_gate or carton");
  }
  if (!(BARCODE_INGEST_VERIFICATION_TYPES as readonly string[]).includes(payload.verification_type)) {
    return failure("invalid_verification_type", "verification_type is invalid for barcode ingest");
  }
  if (SCAN_TYPE_VERIFICATION_MAP[payload.scan_type] !== payload.verification_type) {
    return failure(
      "scan_type_verification_mismatch",
      `scan_type ${payload.scan_type} requires verification_type ${SCAN_TYPE_VERIFICATION_MAP[payload.scan_type]}`,
    );
  }

  const ctn = validateCtnSoBarcode({
    barcodeValue: payload.barcode_value,
    expectedBarcode: payload.expected_barcode,
    orderNumber: payload.order_number,
  });
  if (!ctn.ok) {
    return failure("invalid_barcode", ctn.reason ?? "Invalid CTN-SO barcode");
  }

  return null;
}

export async function processBarcodeScanIngest(
  input: ProcessBarcodeScanIngestInput,
): Promise<BarcodeScanIngestResponse> {
  const headerError = validateIngestHeaders(input.headers);
  if (headerError) return headerError;

  const parsed = parseBarcodeScanPayload(input.payload);
  if (!parsed || (parsed as BarcodeScanIngestFailureResponse).ok === false) {
    return parsed as BarcodeScanIngestFailureResponse;
  }

  const payload = parsed as BarcodeScanPayload;
  const businessError = validateBarcodeScanBusinessRules(payload);
  if (businessError) return businessError;

  const existing = await input.db.findScanByIdempotencyKey(input.idempotencyKey);
  if (existing) {
    return duplicate();
  }

  const order = await input.db.findOrderById(payload.order_id);
  if (!order) {
    return failure("order_not_found", "order_id does not exist");
  }

  const normalizedOrderNumber = payload.order_number.trim().toUpperCase();
  const persistedOrderNumber = order.order_number.trim().toUpperCase();
  if (persistedOrderNumber !== normalizedOrderNumber) {
    return failure("order_number_mismatch", "order_number does not match order");
  }

  const metadata: Record<string, unknown> = {
    source_app: BARCODE_INGEST_SOURCE_APP,
    idempotency_key: input.idempotencyKey,
    submitted_at: payload.submitted_at ?? input.submittedAt,
  };
  if (payload.barcode_app_reference) {
    metadata.barcode_app_reference = payload.barcode_app_reference;
  }

  const insertRow: InsertOperationalScanInput = {
    scan_type: payload.scan_type,
    verification_type: payload.verification_type,
    entity_type: "order",
    entity_id: payload.order_id,
    order_id: payload.order_id,
    barcode_value: payload.barcode_value.trim().toUpperCase(),
    expected_barcode: payload.expected_barcode.trim().toUpperCase(),
    verification_status: "verified",
    scan_source: payload.scan_source,
    actor_role: "barcode_app",
    metadata,
    correlation_id: `barcode-ingest:${input.idempotencyKey}`,
    idempotency_key: input.idempotencyKey,
  };

  const inserted = await input.db.insertScan(insertRow);
  const reference = payload.barcode_app_reference ?? inserted.id;
  return success(inserted.id, reference);
}

export function createSupabaseBarcodeScanIngestDb(client: {
  from(table: string): {
    select(columns: string): {
      eq(column: string, value: string): {
        maybeSingle(): Promise<{ data: Record<string, unknown> | null; error: { message: string } | null }>;
      };
    };
    insert(row: Record<string, unknown>): {
      select(columns: string): {
        single(): Promise<{ data: Record<string, unknown> | null; error: { message: string } | null }>;
      };
    };
  };
}): BarcodeScanIngestDb {
  return {
    async findOrderById(orderId) {
      const { data, error } = await client
        .from("orders")
        .select("id, order_number")
        .eq("id", orderId)
        .maybeSingle();
      if (error) throw new Error(error.message);
      if (!data?.id || typeof data.order_number !== "string") return null;
      return { id: String(data.id), order_number: data.order_number };
    },

    async findScanByIdempotencyKey(key) {
      const { data, error } = await client
        .from("operational_scan_records")
        .select("id, idempotency_key")
        .eq("idempotency_key", key)
        .maybeSingle();
      if (error) throw new Error(error.message);
      if (!data?.id) return null;
      return {
        id: String(data.id),
        idempotency_key: typeof data.idempotency_key === "string" ? data.idempotency_key : null,
      };
    },

    async insertScan(row) {
      const { data, error } = await client
        .from("operational_scan_records")
        .insert({ ...row })
        .select("id")
        .single();
      if (error) throw new Error(error.message);
      if (!data?.id) throw new Error("Insert did not return scan id");
      return { id: String(data.id) };
    },
  };
}
