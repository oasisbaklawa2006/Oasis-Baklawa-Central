import { describe, expect, it, beforeEach } from "vitest";
import { createInMemoryBarcodeExecutionBundle } from "../barcodeExecutionBundle";
import { assertScanAppendOnlyMutation } from "../scanImmutability";

const ENTITY = "00000000-0000-4000-8000-000000000050";
const ORDER = "00000000-0000-4000-8000-000000000051";

const CTX = {
  correlationId: "corr-3c",
  actorUserId: "00000000-0000-4000-8000-000000000099",
  actorRole: "OPERATIONS_MANAGER",
};

describe("barcodeExecutionService", () => {
  const bundle = createInMemoryBarcodeExecutionBundle();

  beforeEach(() => bundle.reset());

  it("verifyOrderBarcode creates scan + scan_verified event", async () => {
    const r = await bundle.execution.verifyOrderBarcode(
      {
        entityType: "order",
        entityId: ENTITY,
        orderId: ORDER,
        barcodeValue: "OB-900",
        expectedBarcode: "OB-900",
      },
      CTX,
    );
    expect(r.verificationStatus).toBe("verified");
    expect(r.eventId).toBeTruthy();
    const events = await bundle.events.listByEntity("order", ENTITY);
    expect(events.some((e) => e.eventType === "scan_verified")).toBe(true);
  });

  it("detects mismatch and emits scan_mismatch", async () => {
    const r = await bundle.execution.verifyCartonBarcode(
      {
        entityType: "carton",
        entityId: ENTITY,
        barcodeValue: "C-1",
        expectedBarcode: "C-2",
      },
      CTX,
    );
    expect(r.verificationStatus).toBe("mismatch");
    const events = await bundle.events.listByEntity("carton", ENTITY);
    expect(events.some((e) => e.eventType === "scan_mismatch")).toBe(true);
  });

  it("detects duplicate scans in window", async () => {
    const input = {
      entityType: "order",
      entityId: ENTITY,
      barcodeValue: "DUP-1",
      expectedBarcode: "DUP-1",
    };
    const first = await bundle.execution.verifyOrderBarcode(input, {
      ...CTX,
      correlationId: "c1",
      idempotencyKey: "dup-a",
    });
    expect(first.verificationStatus).toBe("verified");
    const second = await bundle.execution.verifyOrderBarcode(input, {
      ...CTX,
      correlationId: "c2",
      idempotencyKey: "dup-b",
    });
    expect(second.verificationStatus).toBe("duplicate");
    expect(second.duplicateOfScanId).toBe(first.scanId);
  });

  it("dedupes via idempotency_key replay", async () => {
    const input = {
      entityType: "order",
      entityId: ENTITY,
      barcodeValue: "IDEM-1",
      expectedBarcode: "IDEM-1",
    };
    const key = "scan-once";
    const a = await bundle.execution.verifyOrderBarcode(input, { ...CTX, idempotencyKey: key });
    const b = await bundle.execution.verifyOrderBarcode(input, { ...CTX, idempotencyKey: key });
    expect(a.scanId).toBe(b.scanId);
  });

  it("gate scan uses gate_scan_verified without dispatch completion", async () => {
    const r = await bundle.execution.verifyDispatchGateScan(
      {
        entityType: "dispatch_gate",
        entityId: ENTITY,
        gateId: "north-gate",
        barcodeValue: "NG-1",
        expectedBarcode: "NG-1",
      },
      { ...CTX, actorRole: "DISPATCH_MANAGER" },
    );
    expect(r.verificationStatus).toBe("verified");
    const events = await bundle.events.listByEntity("dispatch_gate", ENTITY);
    expect(events.some((e) => e.eventType === "gate_scan_verified")).toBe(true);
    expect(events.length).toBeGreaterThan(0);
  });

  it("handoff failure emits department_handoff_failed", async () => {
    const r = await bundle.execution.verifyDepartmentHandoff(
      {
        entityType: "handoff",
        entityId: ENTITY,
        fromDepartment: "production",
        toDepartment: "assembly",
        barcodeValue: "H-1",
        expectedBarcode: "H-2",
      },
      CTX,
    );
    expect(r.verificationStatus).toBe("mismatch");
    const events = await bundle.events.listByEntity("handoff", ENTITY);
    expect(events.some((e) => e.eventType === "department_handoff_failed")).toBe(true);
  });

  it("reject requires reason and creates rejected scan", async () => {
    await expect(
      bundle.execution.rejectScan(
        {
          entityType: "order",
          entityId: ENTITY,
          barcodeValue: "X",
          reason: "  ",
        },
        CTX,
      ),
    ).rejects.toThrow(/non-empty/i);
    const r = await bundle.execution.rejectScan(
      {
        entityType: "order",
        entityId: ENTITY,
        barcodeValue: "X",
        reason: "Invalid label",
      },
      CTX,
    );
    expect(r.verificationStatus).toBe("rejected");
  });

  it("denies gate scan for wrong role", async () => {
    await expect(
      bundle.execution.verifyDispatchGateScan(
        {
          entityType: "dispatch_gate",
          entityId: ENTITY,
          gateId: "g1",
          barcodeValue: "NG-1",
          expectedBarcode: "NG-1",
        },
        { ...CTX, actorRole: "FINANCE_EXEC" },
      ),
    ).rejects.toThrow(/cannot perform dispatch gate/i);
  });

  it("scan records are append-only in application layer", () => {
    expect(() => assertScanAppendOnlyMutation("update")).toThrow(/append-only/i);
  });
});
