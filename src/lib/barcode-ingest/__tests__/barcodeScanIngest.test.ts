import { describe, expect, it, vi } from "vitest";
import {
  type BarcodeScanIngestDb,
  type BarcodeScanPayload,
  type InsertOperationalScanInput,
  processBarcodeScanIngest,
  resolveIngestHttpStatus,
  validateBarcodeScanBusinessRules,
  validateIngestHeaders,
  verifyHmacSignature,
} from "@/lib/barcode-ingest";

const ORDER_ID = "11111111-1111-4111-8111-111111111111";
const ORDER_NUMBER = "SO-2026-000136";
const BARCODE = "CTN-SO-2026-000136";

function basePayload(overrides: Partial<BarcodeScanPayload> = {}): BarcodeScanPayload {
  return {
    source_app: "barcode_app",
    order_id: ORDER_ID,
    order_number: ORDER_NUMBER,
    scan_type: "dispatch_gate",
    verification_type: "gate_check",
    entity_type: "order",
    barcode_value: BARCODE,
    expected_barcode: BARCODE,
    verification_status: "verified",
    scan_source: "barcode_app_gate_scan",
    ...overrides,
  };
}

function baseHeaders(overrides: Partial<{ sourceApp: string; idempotencyKey: string; signature: string }> = {}) {
  return {
    sourceApp: "barcode_app",
    idempotencyKey: "idem-dispatch-001",
    signature: "test-signature",
    ...overrides,
  };
}

function createMockDb(options?: {
  order?: { id: string; order_number: string } | null;
  existingScan?: { id: string; idempotency_key: string | null } | null;
  onInsert?: (row: InsertOperationalScanInput) => { id: string };
}): BarcodeScanIngestDb {
  const defaultOrder = { id: ORDER_ID, order_number: ORDER_NUMBER };
  const resolvedOrder = options && "order" in options ? options.order : defaultOrder;
  return {
    findOrderById: vi.fn(async () => resolvedOrder ?? null),
    findScanByIdempotencyKey: vi.fn(async () => options?.existingScan ?? null),
    insertScan: vi.fn(async (row) => {
      return options?.onInsert?.(row) ?? { id: "scan-new-001" };
    }),
  };
}

describe("barcodeScanIngest", () => {
  it("accepts valid dispatch_gate scan", async () => {
    const db = createMockDb();
    const result = await processBarcodeScanIngest({
      headers: baseHeaders({ idempotencyKey: "idem-gate-001" }),
      payload: basePayload(),
      idempotencyKey: "idem-gate-001",
      submittedAt: "2026-06-02T12:00:00.000Z",
      db,
    });

    expect(result).toEqual({
      ok: true,
      scan_id: "scan-new-001",
      reference: "scan-new-001",
      message: "Scan recorded",
    });
    expect(db.insertScan).toHaveBeenCalledOnce();
    expect(db.insertScan).toHaveBeenCalledWith(
      expect.objectContaining({
        scan_type: "dispatch_gate",
        verification_type: "gate_check",
        verification_status: "verified",
        order_id: ORDER_ID,
        barcode_value: BARCODE,
      }),
    );
  });

  it("accepts valid carton identity scan", async () => {
    const db = createMockDb();
    const result = await processBarcodeScanIngest({
      headers: baseHeaders({ idempotencyKey: "idem-carton-001" }),
      payload: basePayload({
        scan_type: "carton",
        verification_type: "identity_match",
        scan_source: "barcode_app_carton_scan",
      }),
      idempotencyKey: "idem-carton-001",
      submittedAt: "2026-06-02T12:00:00.000Z",
      db,
    });

    expect(result.ok).toBe(true);
    if (result.ok && "scan_id" in result) {
      expect(result.scan_id).toBe("scan-new-001");
    }
    expect(db.insertScan).toHaveBeenCalledWith(
      expect.objectContaining({
        scan_type: "carton",
        verification_type: "identity_match",
      }),
    );
  });

  it("rejects missing idempotency key", () => {
    const error = validateIngestHeaders(baseHeaders({ idempotencyKey: "" }));
    expect(error).toEqual({
      ok: false,
      reason: "missing_idempotency_key",
      message: "X-Idempotency-Key is required",
    });
    expect(resolveIngestHttpStatus("missing_idempotency_key")).toBe(400);
  });

  it("does not treat missing signature as a 400 header validation error", () => {
    expect(validateIngestHeaders(baseHeaders({ signature: "" }))).toBeNull();
    expect(resolveIngestHttpStatus("missing_signature")).toBe(401);
  });

  it("maps invalid signature auth failures to HTTP 401", async () => {
    const result = await verifyHmacSignature({
      body: "{}",
      signatureHeader: "deadbeef".repeat(8),
      secret: "test-secret",
    });
    expect(result.ok).toBe(false);
    expect(resolveIngestHttpStatus(result.reason ?? "")).toBe(401);
  });

  it("returns duplicate response without inserting again", async () => {
    const db = createMockDb({
      existingScan: { id: "scan-existing", idempotency_key: "idem-dup-001" },
    });
    const result = await processBarcodeScanIngest({
      headers: baseHeaders({ idempotencyKey: "idem-dup-001" }),
      payload: basePayload(),
      idempotencyKey: "idem-dup-001",
      submittedAt: "2026-06-02T12:00:00.000Z",
      db,
    });

    expect(result).toEqual({
      ok: true,
      duplicate: true,
      message: "Scan already recorded",
    });
    expect(db.insertScan).not.toHaveBeenCalled();
  });

  it("rejects barcode mismatch", () => {
    const error = validateBarcodeScanBusinessRules(
      basePayload({
        barcode_value: "CTN-SO-2026-000999",
        expected_barcode: BARCODE,
      }),
    );
    expect(error?.reason).toBe("invalid_barcode");
  });

  it("rejects wrong order_number", async () => {
    const db = createMockDb();
    const result = await processBarcodeScanIngest({
      headers: baseHeaders({ idempotencyKey: "idem-order-mismatch" }),
      payload: basePayload({ order_number: "SO-2026-000999" }),
      idempotencyKey: "idem-order-mismatch",
      submittedAt: "2026-06-02T12:00:00.000Z",
      db,
    });

    expect(result).toEqual({
      ok: false,
      reason: "invalid_barcode",
      message: expect.stringContaining("order_number"),
    });
    expect(db.insertScan).not.toHaveBeenCalled();
  });

  it("rejects persisted order_number mismatch", async () => {
    const db = createMockDb({
      order: { id: ORDER_ID, order_number: "SO-2026-000001" },
    });
    const result = await processBarcodeScanIngest({
      headers: baseHeaders({ idempotencyKey: "idem-persisted-mismatch" }),
      payload: basePayload(),
      idempotencyKey: "idem-persisted-mismatch",
      submittedAt: "2026-06-02T12:00:00.000Z",
      db,
    });

    expect(result).toEqual({
      ok: false,
      reason: "order_number_mismatch",
      message: "order_number does not match order",
    });
  });

  it("rejects invalid scan_type", () => {
    const error = validateBarcodeScanBusinessRules(
      basePayload({
        scan_type: "order" as BarcodeScanPayload["scan_type"],
        verification_type: "identity_match",
      }),
    );
    expect(error?.reason).toBe("invalid_scan_type");
  });

  it("rejects unverified payload", () => {
    const error = validateBarcodeScanBusinessRules(
      basePayload({
        verification_status: "scanned" as BarcodeScanPayload["verification_status"],
      }),
    );
    expect(error?.reason).toBe("unverified_payload");
  });

  it("rejects missing order_id at business validation", () => {
    const error = validateBarcodeScanBusinessRules(basePayload({ order_id: "   " }));
    expect(error?.reason).toBe("missing_order_id");
  });

  it("rejects unknown order_id", async () => {
    const db = createMockDb({ order: null });
    const result = await processBarcodeScanIngest({
      headers: baseHeaders({ idempotencyKey: "idem-missing-order" }),
      payload: basePayload(),
      idempotencyKey: "idem-missing-order",
      submittedAt: "2026-06-02T12:00:00.000Z",
      db,
    });

    expect(result).toEqual({
      ok: false,
      reason: "order_not_found",
      message: "order_id does not exist",
    });
  });
});
