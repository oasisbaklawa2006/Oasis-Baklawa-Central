import { describe, expect, it } from "vitest";
import { projectDispatchCompletion } from "@/lib/dispatch-completion";
import {
  buildGoldenChainWizardCompletionInput,
  hasVerifiedManualReadinessReview,
} from "../goldenChainCompletionInput";
import type { DispatchCompletionInput } from "@/lib/dispatch-completion/dispatchCompletionTypes";

const base: DispatchCompletionInput = {
  orderId: "00000000-0000-4000-8000-000000000099",
  queueItemId: null,
  readinessStatus: "gate_eligible",
  financeSignal: "ready",
  financeReleaseStatus: "commercially_released",
  reservationReady: false,
  orderAlreadyDispatched: false,
  securityGatePassed: false,
  courierManifestAttached: false,
  openCompletionHolds: [],
};

describe("goldenChainCompletionInput", () => {
  it("maps prepare evidence and scans to wizard completion eligibility", () => {
    const input = buildGoldenChainWizardCompletionInput(base, {
      orderStatus: "cleared_for_dispatch",
      dispatchEvidencePrepared: true,
      financeCommerciallyReleased: true,
      scan: {
        hasUnresolvedMismatch: false,
        hasRejectedGateScan: false,
        gateScanVerified: true,
        cartonBarcodeVerified: true,
        latestAt: "2026-01-01T00:00:00Z",
      },
      readinessSlices: [
        { evidenceType: "document_placeholder", evidenceStatus: "verified", createdAt: "2026-01-01" },
      ],
      completionAttested: false,
    });
    const projection = projectDispatchCompletion(input);
    expect(projection.completionStatus).toBe("completion_eligible");
    expect(input.reservationReady).toBe(true);
    expect(input.completionPolicy).toBe("pre_dispatch_wizard");
  });

  it("detects verified manual readiness review", () => {
    expect(
      hasVerifiedManualReadinessReview([
        { evidenceType: "gate_scan", evidenceStatus: "verified", createdAt: "t" },
      ]),
    ).toBe(false);
    expect(
      hasVerifiedManualReadinessReview([
        { evidenceType: "manual_readiness_review", evidenceStatus: "verified", createdAt: "t" },
      ]),
    ).toBe(true);
  });
});
