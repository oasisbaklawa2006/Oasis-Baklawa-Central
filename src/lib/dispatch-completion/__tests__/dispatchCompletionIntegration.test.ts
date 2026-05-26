import { describe, expect, it } from "vitest";
import { projectDispatchReadiness } from "@/lib/dispatch-readiness";
import type { DispatchReadinessInput } from "@/lib/dispatch-readiness";
import { projectFinanceRelease } from "@/lib/finance-governance/financeReleaseEligibility";
import type { FinanceGovernanceInput } from "@/lib/finance-governance/financeGovernanceTypes";
import { resolveDispatchFinanceSignal } from "@/lib/dispatch-readiness/financeDispatchSignal";
import { projectDispatchCompletion } from "../dispatchCompletionProjection";
import type { DispatchCompletionInput } from "../dispatchCompletionTypes";

describe("dispatch completion integration (4B + 4C + 4D)", () => {
  it("eligible completion when readiness gate and finance release align", () => {
    const readinessInput: DispatchReadinessInput = {
      orderId: "00000000-0000-4000-8000-000000000401",
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
    expect(readiness.readinessStatus).toBe("gate_eligible");

    const financeInput: FinanceGovernanceInput = {
      orderId: readinessInput.orderId,
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
    const finance = projectFinanceRelease(financeInput);
    const signal = resolveDispatchFinanceSignal(financeInput);

    const completionInput: DispatchCompletionInput = {
      orderId: readinessInput.orderId,
      queueItemId: readinessInput.queue.queueItemId,
      readinessStatus: readiness.readinessStatus,
      financeSignal: signal,
      financeReleaseStatus: finance.releaseStatus,
      reservationReady: true,
      orderAlreadyDispatched: false,
      securityGatePassed: true,
      courierManifestAttached: true,
      openCompletionHolds: [],
    };

    const completion = projectDispatchCompletion(completionInput);
    expect(completion.completionStatus).toBe("completion_eligible");
    expect(completion.warnings.some((w) => w.includes("does NOT set orders.status"))).toBe(true);
  });
});
