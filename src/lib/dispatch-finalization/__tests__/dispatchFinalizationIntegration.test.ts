import { describe, expect, it } from "vitest";
import { projectDispatchReadiness } from "@/lib/dispatch-readiness";
import type { DispatchReadinessInput } from "@/lib/dispatch-readiness";
import { projectFinanceRelease } from "@/lib/finance-governance/financeReleaseEligibility";
import type { FinanceGovernanceInput } from "@/lib/finance-governance/financeGovernanceTypes";
import { projectDispatchCompletion } from "@/lib/dispatch-completion/dispatchCompletionProjection";
import type { DispatchCompletionInput } from "@/lib/dispatch-completion/dispatchCompletionTypes";
import { projectDispatchRelease } from "../dispatchFinalizationProjection";
import type { DispatchFinalizationInput } from "../dispatchFinalizationTypes";

describe("dispatch finalization integration (4B→4C→4D→4E)", () => {
  it("release ready when full governance chain satisfied", () => {
    const readinessInput: DispatchReadinessInput = {
      orderId: "00000000-0000-4000-8000-000000000601",
      queue: { queueItemId: "q1", isActive: true, isCompleted: false, hasVersionConflict: false },
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
    const readiness = projectDispatchReadiness(readinessInput);

    const financeInput: FinanceGovernanceInput = {
      orderId: readinessInput.orderId,
      orderValue: 50_000,
      advanceRequired: 10_000,
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
    const finance = projectFinanceRelease(financeInput);

    const completionInput: DispatchCompletionInput = {
      orderId: readinessInput.orderId,
      queueItemId: "q1",
      readinessStatus: readiness.readinessStatus,
      financeSignal: "ready",
      financeReleaseStatus: finance.releaseStatus,
      reservationReady: true,
      orderAlreadyDispatched: false,
      securityGatePassed: true,
      courierManifestAttached: true,
      openCompletionHolds: [],
    };
    const completion = projectDispatchCompletion(completionInput);
    expect(completion.completionStatus).toBe("completion_eligible");

    const finalizationInput: DispatchFinalizationInput = {
      orderId: readinessInput.orderId,
      currentOrderStatus: "cleared_for_dispatch",
      readinessStatus: readiness.readinessStatus,
      financeSignal: "ready",
      financeReleaseStatus: "commercially_released",
      completionStatus: "completion_attested",
      reservationReady: true,
      transporterHandoffFinalized: true,
      gateReference: "gate-601",
      completionReference: "attest-601",
      transporterReference: "TP-601",
      openReleaseBlockers: [],
    };

    const release = projectDispatchRelease(finalizationInput);
    expect(readiness.readinessStatus).toBe("gate_eligible");
    expect(finance.releaseStatus).toBe("commercially_released");
    expect(release.releaseStatus).toBe("dispatch_release_ready");
    expect(release.canFinalize).toBe(true);
  });
});
