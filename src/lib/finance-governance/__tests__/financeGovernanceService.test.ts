import { describe, expect, it } from "vitest";
import {
  createFinanceGovernanceService,
  createInMemoryFinanceEventSink,
} from "../financeGovernanceService";
import { createInMemoryFinanceEvidenceStore } from "../inMemoryFinanceEvidenceStore";
import { FinanceGovernanceError } from "../financeGovernanceTypes";
import type { FinanceGovernanceInput } from "../financeGovernanceTypes";

const ctx = {
  correlationId: "c1",
  actorUserId: "00000000-0000-4000-8000-000000000099",
  actorRole: "FINANCE_HEAD",
};

const ready: FinanceGovernanceInput = {
  orderId: "00000000-0000-4000-8000-000000000201",
  orderValue: 120_000,
  advanceRequired: 40_000,
  advanceVerified: true,
  creditApproved: true,
  openHoldTypes: [],
  reservationReady: true,
  dispatchReadinessGateEligible: true,
  complaintSeverity: "none",
  staleFinanceReview: false,
  manualOverrideCount: 0,
  rejectionCount: 0,
  escalationCount: 0,
};

function svc(controlMode: "demo" | "core" | "blocked" = "demo") {
  return createFinanceGovernanceService({
    evidence: createInMemoryFinanceEvidenceStore(),
    events: createInMemoryFinanceEventSink(),
    controlMode,
  });
}

describe("financeGovernanceService", () => {
  it("commercial release records event without payment capture", async () => {
    const s = svc();
    const { projection, eventId } = await s.commercialRelease(ready, ctx);
    expect(projection.releaseStatus).toBe("commercially_released");
    expect(eventId).toBeTruthy();
    const evts = await s.listEvents(ready.orderId);
    expect(evts.some((e) => e.eventType === "finance_commercially_released")).toBe(true);
  });

  it("commercial release appends finance_review_evidence", async () => {
    const evidence = createInMemoryFinanceEvidenceStore();
    const s = createFinanceGovernanceService({
      evidence,
      events: createInMemoryFinanceEventSink(),
    });
    await s.commercialRelease(ready, ctx);
    const rows = await s.listEvidence(ready.orderId);
    expect(rows.some((r) => r.reviewType === "commercial_release")).toBe(true);
  });

  it("rejects release without typed rejection reason", async () => {
    const s = svc();
    await expect(s.rejectRelease(ready, ctx)).rejects.toThrow(FinanceGovernanceError);
  });

  it("denies dispatch manager finance actions", async () => {
    const s = svc();
    await expect(
      s.startReview(ready, { ...ctx, actorRole: "DISPATCH_MANAGER" }),
    ).rejects.toThrow(FinanceGovernanceError);
  });

  it("fail-closes hold/release writes when Core control authority is blocked", async () => {
    const s = svc("blocked");
    await expect(s.placeHold(ready.orderId, "advance_unverified", ctx)).rejects.toMatchObject({
      code: "core_prerequisite",
    });
    await expect(
      s.releaseHold(ready.orderId, "advance_unverified", ctx, { holdEventId: "hold-1" }),
    ).rejects.toMatchObject({ code: "core_prerequisite" });
  });

  it("startReview persists finance_review_evidence credit_review pending", async () => {
    const evidence = createInMemoryFinanceEvidenceStore();
    const s = createFinanceGovernanceService({
      evidence,
      events: createInMemoryFinanceEventSink(),
    });
    const { evidenceId } = await s.startReview(ready, ctx);
    expect(evidenceId).toBeTruthy();
    const rows = await s.listEvidence(ready.orderId);
    expect(
      rows.some((r) => r.reviewType === "credit_review" && r.reviewStatus === "pending"),
    ).toBe(true);
  });
});
