import { describe, expect, it } from "vitest";
import { detectDuplicateScan } from "../scanDuplicateDetection";
import type { OperationalScanRecord } from "../barcodeExecutionTypes";

function scan(partial: Partial<OperationalScanRecord> & Pick<OperationalScanRecord, "id" | "createdAt">): OperationalScanRecord {
  return {
    id: partial.id,
    scanType: "order",
    verificationType: "identity_match",
    entityType: "order",
    entityId: "00000000-0000-4000-8000-000000000001",
    orderId: null,
    queueItemId: null,
    barcodeValue: "OB-100",
    expectedBarcode: "OB-100",
    verificationStatus: "verified",
    mismatchReason: null,
    scanSource: "test",
    scanDeviceId: null,
    actorId: null,
    actorRole: null,
    actorDepartment: null,
    photoEvidenceUrl: null,
    metadata: {},
    correlationId: "c1",
    idempotencyKey: null,
    createdAt: partial.createdAt,
    ...partial,
  };
}

describe("scanDuplicateDetection", () => {
  it("detects duplicate within window", () => {
    const now = Date.now();
    const recent = [
      scan({
        id: "s1",
        createdAt: new Date(now - 5_000).toISOString(),
      }),
    ];
    const r = detectDuplicateScan({
      barcodeValue: "ob-100",
      entityType: "order",
      entityId: "00000000-0000-4000-8000-000000000001",
      verificationType: "identity_match",
      recentScans: recent,
      nowMs: now,
    });
    expect(r.isDuplicate).toBe(true);
    expect(r.duplicateOfScanId).toBe("s1");
  });

  it("ignores scans outside window", () => {
    const now = Date.now();
    const recent = [
      scan({
        id: "s1",
        createdAt: new Date(now - 120_000).toISOString(),
      }),
    ];
    const r = detectDuplicateScan({
      barcodeValue: "OB-100",
      entityType: "order",
      entityId: "00000000-0000-4000-8000-000000000001",
      verificationType: "identity_match",
      recentScans: recent,
      nowMs: now,
    });
    expect(r.isDuplicate).toBe(false);
  });
});
