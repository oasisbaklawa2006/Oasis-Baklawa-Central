import { describe, expect, it } from "vitest";
import {
  createDispatchReadinessService,
  createInMemoryDispatchEventSink,
} from "../dispatchReadinessService";
import { createInMemoryDispatchEvidenceStore } from "../inMemoryDispatchEvidenceStore";
import { DispatchReadinessError } from "../dispatchReadinessTypes";
import type { DispatchReadinessInput } from "../dispatchReadinessTypes";

const ctx = {
  correlationId: "corr-1",
  actorUserId: "00000000-0000-4000-8000-000000000099",
  actorRole: "DISPATCH_MANAGER",
};

const readyInput: DispatchReadinessInput = {
  orderId: "00000000-0000-4000-8000-000000000101",
  queue: { queueItemId: "q-1", isActive: true, isCompleted: false, hasVersionConflict: false },
  scan: {
    hasUnresolvedMismatch: false,
    hasRejectedGateScan: false,
    gateScanVerified: true,
    cartonBarcodeVerified: true,
  },
  reservationStatus: "reserved",
  financeSignal: "ready",
  packingEvidenceVerified: true,
  documentPlaceholderPresent: true,
  openExceptionTypes: [],
};

function service() {
  return createDispatchReadinessService({
    evidence: createInMemoryDispatchEvidenceStore(),
    events: createInMemoryDispatchEventSink(),
  });
}

describe("dispatchReadinessService", () => {
  it("records readiness review without dispatch completion", async () => {
    const svc = service();
    const { projection, eventId } = await svc.reviewReadiness(readyInput, ctx);
    expect(projection.readinessStatus).toBe("gate_eligible");
    expect(eventId).toBeTruthy();
    const evts = await svc.listEvents(readyInput.orderId);
    expect(evts.some((e) => e.eventType === "dispatch_gate_eligible")).toBe(true);
  });

  it("reviewReadiness appends dispatch_readiness_evidence", async () => {
    const evidence = createInMemoryDispatchEvidenceStore();
    const svc = createDispatchReadinessService({
      evidence,
      events: createInMemoryDispatchEventSink(),
    });
    const { evidenceId } = await svc.reviewReadiness(readyInput, ctx);
    expect(evidenceId).toBeTruthy();
    const rows = await svc.listEvidence(readyInput.orderId);
    expect(rows.some((r) => r.evidenceType === "manual_readiness_review" && r.evidenceStatus === "verified")).toBe(
      true,
    );
  });

  it("rejects forbidden mark_dispatched via authority path", async () => {
    const svc = service();
    await expect(
      svc.reviewReadiness(readyInput, { ...ctx, actorRole: "FINANCE_HEAD" }),
    ).rejects.toThrow(DispatchReadinessError);
  });

  it("appends evidence on add", async () => {
    const svc = service();
    const { evidence } = await svc.addEvidence(
      {
        orderId: readyInput.orderId,
        queueItemId: null,
        evidenceType: "packing_photo",
        evidenceStatus: "verified",
        evidenceRef: "photo-1",
        photoRef: "storage/p1",
        documentRef: null,
        barcodeRef: null,
        actorId: null,
        actorRole: null,
        actorDepartment: null,
        correlationId: ctx.correlationId,
        metadata: {},
      },
      ctx,
    );
    expect(evidence.evidenceType).toBe("packing_photo");
  });
});
