import { describe, expect, it } from "vitest";
import {
  createDispatchCompletionService,
  createInMemoryDispatchCompletionEventSink,
} from "../dispatchCompletionService";
import { createInMemoryDispatchCompletionEvidenceStore } from "../inMemoryDispatchCompletionEvidenceStore";
import { DispatchCompletionError } from "../dispatchCompletionTypes";
import type { DispatchCompletionInput } from "../dispatchCompletionTypes";

const ctx = {
  correlationId: "corr-4d",
  actorUserId: "00000000-0000-4000-8000-000000000099",
  actorRole: "DISPATCH_MANAGER",
  attestationReason: "Staging governed attestation — no order mutation",
};

const eligible: DispatchCompletionInput = {
  orderId: "00000000-0000-4000-8000-000000000301",
  queueItemId: "q-d1",
  readinessStatus: "gate_eligible",
  financeSignal: "ready",
  financeReleaseStatus: "commercially_released",
  reservationReady: true,
  orderAlreadyDispatched: false,
  securityGatePassed: true,
  courierManifestAttached: true,
  openCompletionHolds: [],
};

function service() {
  return createDispatchCompletionService({
    evidence: createInMemoryDispatchCompletionEvidenceStore(),
    events: createInMemoryDispatchCompletionEventSink(),
  });
}

describe("dispatchCompletionService", () => {
  it("attests completion with evidence and event only", async () => {
    const svc = service();
    const { projection, evidence } = await svc.attestCompletion(eligible, ctx);
    expect(projection.completionStatus).toBe("completion_attested");
    expect(evidence.evidenceType).toBe("completion_attestation");
    const evts = await svc.listEvents(eligible.orderId);
    expect(evts.some((e) => e.eventType === "dispatch_completion_attested")).toBe(true);
  });

  it("denies attest when not completion_eligible", async () => {
    const svc = service();
    await expect(
      svc.attestCompletion({ ...eligible, securityGatePassed: false }, ctx),
    ).rejects.toThrow(DispatchCompletionError);
  });

  it("denies finance role", async () => {
    const svc = service();
    await expect(
      svc.reviewCompletion(eligible, { ...ctx, actorRole: "FINANCE_HEAD" }),
    ).rejects.toThrow(DispatchCompletionError);
  });

  it("requires attestation reason", async () => {
    const svc = service();
    await expect(
      svc.attestCompletion(eligible, { ...ctx, attestationReason: "" }),
    ).rejects.toThrow(DispatchCompletionError);
  });

  it("blocks duplicate completion attestation", async () => {
    const svc = service();
    await svc.attestCompletion(eligible, ctx);
    await expect(svc.attestCompletion(eligible, ctx)).rejects.toMatchObject({
      code: "not_eligible",
      message: expect.stringMatching(/already attested/i),
    });
  });
});
