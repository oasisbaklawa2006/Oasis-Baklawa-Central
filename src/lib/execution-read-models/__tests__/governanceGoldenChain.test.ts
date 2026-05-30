import { describe, expect, it } from "vitest";
import { deriveCompletionInputFromSlices } from "../adapters/completionSignalAdapter";
import {
  deriveCompletionStatusFromEvidence,
  deriveReadinessStatusFromEvidence,
  isGateEligibleFromReadinessEvidence,
  resolveCompletionReferenceFromEvidence,
  resolveGateReferenceFromSlices,
  resolveTransporterReference,
} from "../adapters/governanceEvidenceFusion";
import { deriveFinalizationInputFromSlices } from "../adapters/finalizationSignalAdapter";
import { deriveFinanceSignalFromSlices } from "../adapters/financeSignalAdapter";
import { projectFinanceRelease } from "@/lib/finance-governance/financeReleaseEligibility";
import { projectDispatchCompletion } from "@/lib/dispatch-completion";
import { projectDispatchRelease as projectFinalizationRelease } from "@/lib/dispatch-finalization/dispatchFinalizationProjection";
import {
  createDispatchReadinessService,
  createInMemoryDispatchEventSink,
} from "@/lib/dispatch-readiness/dispatchReadinessService";
import { createInMemoryDispatchEvidenceStore } from "@/lib/dispatch-readiness/inMemoryDispatchEvidenceStore";
import type { DispatchReadinessInput } from "@/lib/dispatch-readiness/dispatchReadinessTypes";
import {
  createFinanceGovernanceService,
  createInMemoryFinanceEventSink,
} from "@/lib/finance-governance/financeGovernanceService";
import { createInMemoryFinanceEvidenceStore } from "@/lib/finance-governance/inMemoryFinanceEvidenceStore";
import type { FinanceGovernanceInput } from "@/lib/finance-governance/financeGovernanceTypes";

const readinessCtx = {
  correlationId: "golden-readiness",
  actorUserId: "00000000-0000-4000-8000-000000000099",
  actorRole: "DISPATCH_MANAGER" as const,
};

const financeCtx = {
  correlationId: "golden-finance",
  actorUserId: "00000000-0000-4000-8000-000000000099",
  actorRole: "FINANCE_HEAD" as const,
  overrideReason: null,
  rejectionReason: null,
};

const readyInput: DispatchReadinessInput = {
  orderId: "b12e0115-1203-47d8-991d-e419812b0001",
  queue: { queueItemId: null, isActive: true, isCompleted: false, hasVersionConflict: false },
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

const financeReady: FinanceGovernanceInput = {
  orderId: readyInput.orderId,
  orderValue: 100_000,
  advanceRequired: 30_000,
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

describe("governance golden chain fusion", () => {
  it("readiness review persists dispatch_readiness_evidence", async () => {
    const evidence = createInMemoryDispatchEvidenceStore();
    const svc = createDispatchReadinessService({
      evidence,
      events: createInMemoryDispatchEventSink(),
    });
    const { evidenceId } = await svc.reviewReadiness(readyInput, readinessCtx);
    expect(evidenceId).toBeTruthy();
    const rows = await evidence.listByOrder(readyInput.orderId);
    expect(rows.some((r) => r.evidenceType === "manual_readiness_review")).toBe(true);
  });

  it("finance review start persists credit_review evidence", async () => {
    const evidence = createInMemoryFinanceEvidenceStore();
    const svc = createFinanceGovernanceService({
      evidence,
      events: createInMemoryFinanceEventSink(),
    });
    await svc.startReview(financeReady, financeCtx);
    const rows = await evidence.listByOrder(financeReady.orderId);
    expect(rows.some((r) => r.reviewType === "credit_review" && r.reviewStatus === "pending")).toBe(true);
  });

  it("commercial release persists finance_review_evidence", async () => {
    const evidence = createInMemoryFinanceEvidenceStore();
    const svc = createFinanceGovernanceService({
      evidence,
      events: createInMemoryFinanceEventSink(),
    });
    await svc.commercialRelease(financeReady, financeCtx);
    const rows = await evidence.listByOrder(financeReady.orderId);
    expect(rows.some((r) => r.reviewType === "commercial_release" && r.reviewStatus === "released")).toBe(
      true,
    );
  });

  it("finance signal becomes ready after commercial release evidence and gate eligibility", () => {
    const readinessEvidence = [
      {
        evidenceType: "manual_readiness_review",
        evidenceStatus: "verified",
        createdAt: new Date().toISOString(),
      },
    ];
    expect(isGateEligibleFromReadinessEvidence(readinessEvidence)).toBe(true);
    const fusion = deriveFinanceSignalFromSlices(
      {
        orderId: financeReady.orderId,
        orderValue: financeReady.orderValue,
        advanceRequired: financeReady.advanceRequired,
        advanceVerified: true,
        paymentStatus: "verified_advance",
        updatedAt: new Date().toISOString(),
      },
      [{ reviewStatus: "released", reviewType: "commercial_release", createdAt: new Date().toISOString() }],
      { dispatchReadinessGateEligible: true },
    );
    expect(fusion.financeSignal).toBe("ready");
    expect(projectFinanceRelease(fusion.input).releaseStatus).toBe("commercially_released");
  });

  it("completion becomes eligible after finance + readiness evidence", () => {
    const completionEvidence = [
      {
        evidenceType: "completion_review",
        evidenceStatus: "verified",
        createdAt: new Date().toISOString(),
      },
    ];
    const fusion = deriveCompletionInputFromSlices({
      orderId: readyInput.orderId,
      orderStatus: "cleared_for_dispatch",
      readinessStatus: deriveReadinessStatusFromEvidence([
        { evidenceType: "manual_readiness_review", evidenceStatus: "verified", createdAt: new Date().toISOString() },
      ]),
      financeSignal: "ready",
      financeReleaseStatus: "commercially_released",
      reservationReady: true,
      scanRejected: false,
      scanMismatch: false,
      evidence: completionEvidence,
    });
    const projection = projectDispatchCompletion(fusion.input);
    expect(projection.completionStatus).toBe("completion_eligible");
  });

  it("completion attestation does not imply dispatched order status", () => {
    const status = deriveCompletionStatusFromEvidence(
      [{ evidenceType: "completion_attestation", evidenceStatus: "verified", createdAt: new Date().toISOString() }],
      "cleared_for_dispatch",
    );
    expect(status).toBe("completion_attested");
  });

  it("finalization becomes eligible with fused references", () => {
    const gateRef = "GATE-REF-1";
    const completionRef = "ATTEST-1";
    const fusion = deriveFinalizationInputFromSlices({
      orderId: readyInput.orderId,
      currentOrderStatus: "cleared_for_dispatch",
      readinessStatus: "gate_eligible",
      financeSignal: "ready",
      financeReleaseStatus: "commercially_released",
      completionStatus: "completion_attested",
      reservationReady: true,
      transporterReference: resolveTransporterReference(null, gateRef, completionRef),
      gateReference: gateRef,
      completionReference: completionRef,
      lineage: [],
      financeBlocked: false,
      scanBlocked: false,
    });
    const projection = projectFinalizationRelease(fusion.input);
    expect(projection.canFinalize).toBe(true);
  });

  it("resolves gate and completion references from evidence slices", () => {
    const gate = resolveGateReferenceFromSlices(
      [{ evidenceType: "manual_readiness_review", evidenceStatus: "verified", evidenceRef: "READINESS-OK", createdAt: new Date().toISOString() }],
      [],
    );
    expect(gate).toBe("READINESS-OK");
    const completion = resolveCompletionReferenceFromEvidence([
      { evidenceType: "completion_attestation", evidenceStatus: "verified", evidenceRef: "ATTEST-OK", createdAt: new Date().toISOString() },
    ]);
    expect(completion).toBe("ATTEST-OK");
  });
});
