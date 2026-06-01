import type { DispatchCompletionInput } from "@/lib/dispatch-completion/dispatchCompletionTypes";
import type { ReadinessEvidenceSlice } from "@/lib/execution-read-models/adapters/readinessSignalAdapter";
import type { ReadinessScanSlice } from "@/lib/execution-read-models/adapters/readinessSignalAdapter";

export interface GoldenChainCompletionContext {
  orderStatus: string;
  dispatchEvidencePrepared: boolean;
  financeCommerciallyReleased: boolean;
  scan: ReadinessScanSlice;
  readinessSlices: ReadinessEvidenceSlice[];
  completionAttested: boolean;
}

export function hasVerifiedCompletionAttestation(
  completionSlices: { evidenceType: string; evidenceStatus: string }[],
): boolean {
  return completionSlices.some(
    (e) => e.evidenceType === "completion_attestation" && e.evidenceStatus === "verified",
  );
}

export function hasVerifiedManualReadinessReview(readinessSlices: ReadinessEvidenceSlice[]): boolean {
  return readinessSlices.some(
    (e) => e.evidenceType === "manual_readiness_review" && e.evidenceStatus === "verified",
  );
}

/**
 * Golden Chain wizard completion input — aligns attestation eligibility with 24D stage order
 * (completion before reservation / dispatch finalize).
 */
export function buildGoldenChainWizardCompletionInput(
  base: DispatchCompletionInput,
  ctx: GoldenChainCompletionContext,
): DispatchCompletionInput {
  const clearedForDispatch = ctx.orderStatus.trim().toLowerCase() === "cleared_for_dispatch";
  const gateFromPrepare =
    ctx.scan.gateScanVerified &&
    !ctx.scan.hasRejectedGateScan &&
    !ctx.scan.hasUnresolvedMismatch;
  const manifestFromPrepare = ctx.readinessSlices.some(
    (e) => e.evidenceType === "document_placeholder" && e.evidenceStatus === "verified",
  );

  return {
    ...base,
    completionPolicy: "pre_dispatch_wizard",
    reservationReady: true,
    securityGatePassed:
      ctx.completionAttested ||
      gateFromPrepare ||
      base.securityGatePassed,
    courierManifestAttached:
      ctx.completionAttested ||
      manifestFromPrepare ||
      ctx.financeCommerciallyReleased ||
      base.courierManifestAttached,
    openCompletionHolds:
      clearedForDispatch && ctx.dispatchEvidencePrepared && ctx.financeCommerciallyReleased
        ? base.openCompletionHolds.filter(
            (h) => h !== "security_gate_pending" && h !== "courier_manifest_missing",
          )
        : base.openCompletionHolds,
  };
}
