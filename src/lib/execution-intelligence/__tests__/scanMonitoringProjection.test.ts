import { describe, expect, it } from "vitest";
import { listPendingGateVerifications, projectScanHotspots } from "../scanMonitoringProjection";
import { baseIntelligenceInput } from "./fixtures";

describe("scanMonitoringProjection", () => {
  it("lists pending gate verifications", () => {
    const pending = listPendingGateVerifications([
      {
        id: "g1",
        scanType: "dispatch_gate",
        verificationType: "gate_check",
        entityType: "gate",
        entityId: "00000000-0000-4000-8000-000000000099",
        orderId: null,
        queueItemId: null,
        barcodeValue: "NG-1",
        expectedBarcode: "NG-2",
        verificationStatus: "mismatch",
        mismatchReason: "x",
        scanSource: "t",
        scanDeviceId: null,
        actorId: null,
        actorRole: null,
        actorDepartment: null,
        photoEvidenceUrl: null,
        metadata: {},
        correlationId: "c",
        idempotencyKey: null,
        createdAt: "2026-05-24T12:00:00.000Z",
      },
    ]);
    expect(pending).toHaveLength(1);
  });

  it("aggregates scan hotspots", () => {
    const hotspots = projectScanHotspots(
      baseIntelligenceInput({
        scans: [
          {
            id: "s1",
            scanType: "order",
            verificationType: "identity_match",
            entityType: "order",
            entityId: "1",
            orderId: null,
            queueItemId: null,
            barcodeValue: "A",
            expectedBarcode: null,
            verificationStatus: "mismatch",
            mismatchReason: null,
            scanSource: "t",
            scanDeviceId: null,
            actorId: null,
            actorRole: null,
            actorDepartment: null,
            photoEvidenceUrl: null,
            metadata: {},
            correlationId: "c",
            idempotencyKey: null,
            createdAt: "2026-05-24T12:00:00.000Z",
          },
          {
            id: "s2",
            scanType: "order",
            verificationType: "identity_match",
            entityType: "order",
            entityId: "2",
            orderId: null,
            queueItemId: null,
            barcodeValue: "B",
            expectedBarcode: null,
            verificationStatus: "mismatch",
            mismatchReason: null,
            scanSource: "t",
            scanDeviceId: null,
            actorId: null,
            actorRole: null,
            actorDepartment: null,
            photoEvidenceUrl: null,
            metadata: {},
            correlationId: "c2",
            idempotencyKey: null,
            createdAt: "2026-05-24T11:00:00.000Z",
          },
        ],
      }),
    );
    expect(hotspots[0]?.count).toBe(2);
  });
});
