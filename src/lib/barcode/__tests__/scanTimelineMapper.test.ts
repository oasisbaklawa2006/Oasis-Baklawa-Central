import { describe, expect, it } from "vitest";
import type { OperationalScanRecord } from "@/lib/barcode-execution/barcodeExecutionTypes";
import {
  mapOperationalScansToEventInputs,
  mapScanTypeToDomain,
  mapToTimelineRow,
} from "@/lib/barcode/scanTimelineMapper";
import { deriveScanAnomalies } from "@/lib/barcode/scanLifecycle";

function scan(overrides: Partial<OperationalScanRecord>): OperationalScanRecord {
  return {
    id: overrides.id ?? "scan-1",
    scanType: overrides.scanType ?? "carton",
    verificationType: overrides.verificationType ?? "identity_match",
    entityType: overrides.entityType ?? "order",
    entityId: overrides.entityId ?? "entity-1",
    orderId: overrides.orderId ?? null,
    queueItemId: overrides.queueItemId ?? null,
    barcodeValue: overrides.barcodeValue ?? "CTN-SO-2026-000001",
    expectedBarcode: overrides.expectedBarcode ?? "CTN-SO-2026-000001",
    verificationStatus: overrides.verificationStatus ?? "verified",
    mismatchReason: overrides.mismatchReason ?? null,
    scanSource: overrides.scanSource ?? "barcode_app_carton_scan",
    scanDeviceId: overrides.scanDeviceId ?? null,
    actorId: overrides.actorId ?? null,
    actorRole: overrides.actorRole ?? "operator",
    actorDepartment: overrides.actorDepartment ?? null,
    photoEvidenceUrl: overrides.photoEvidenceUrl ?? null,
    metadata: overrides.metadata ?? {},
    correlationId: overrides.correlationId ?? "corr-1",
    idempotencyKey: overrides.idempotencyKey ?? "idem-1",
    createdAt: overrides.createdAt ?? "2026-06-02T10:00:00.000Z",
  };
}

describe("scanTimelineMapper", () => {
  it("maps dispatch_gate scans to dispatch domain", () => {
    expect(mapScanTypeToDomain("dispatch_gate")).toBe("dispatch");
    expect(mapScanTypeToDomain("carton")).toBe("carton");
  });

  it("assigns monotonic sequence in chronological order", () => {
    const inputs = mapOperationalScansToEventInputs([
      scan({ id: "b", createdAt: "2026-06-02T11:00:00.000Z", barcodeValue: "CTN-A" }),
      scan({ id: "a", createdAt: "2026-06-02T10:00:00.000Z", barcodeValue: "CTN-B" }),
    ]);
    expect(inputs[0]?.id).toBe("a");
    expect(inputs[0]?.sequence).toBe(1);
    expect(inputs[1]?.id).toBe("b");
    expect(inputs[1]?.sequence).toBe(2);
  });

  it("derives duplicate_scan anomaly from repeated barcode in window", () => {
    const inputs = mapOperationalScansToEventInputs([
      scan({ id: "dup-1", barcodeValue: "CTN-SAME", createdAt: "2026-06-02T10:00:00.000Z" }),
      scan({ id: "dup-2", barcodeValue: "CTN-SAME", createdAt: "2026-06-02T10:01:00.000Z" }),
    ]);
    const anomalies = deriveScanAnomalies(inputs, true);
    expect(anomalies.some((a) => a.kind === "duplicate_scan")).toBe(true);
  });

  it("maps timeline row fields for UI display", () => {
    const row = mapToTimelineRow(scan({ id: "ui-1", idempotencyKey: "idem-ui" }));
    expect(row.id).toBe("ui-1");
    expect(row.idempotencyKey).toBe("idem-ui");
    expect(row.barcodeValue).toBe("CTN-SO-2026-000001");
  });
});
