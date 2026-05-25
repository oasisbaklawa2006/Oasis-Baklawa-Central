import {
  buildReleaseBlockingReasons,
  buildReleaseRecommendation,
  buildReleaseWarnings,
  deriveDispatchReleaseStatus,
} from "./dispatchReleaseEligibility";
import type { DispatchFinalizationInput, DispatchReleaseProjection } from "./dispatchFinalizationTypes";

export function projectDispatchRelease(input: DispatchFinalizationInput): DispatchReleaseProjection {
  const releaseStatus = deriveDispatchReleaseStatus(input);
  const blockingReasons = buildReleaseBlockingReasons(input);
  const warnings = buildReleaseWarnings(releaseStatus);

  return {
    orderId: input.orderId,
    releaseStatus,
    blockingReasons,
    warnings,
    releaseRecommendation: buildReleaseRecommendation(releaseStatus),
    canFinalize: releaseStatus === "dispatch_release_ready",
    canPublishCustomerRelease: releaseStatus === "dispatch_finalized",
    evaluatedAt: new Date().toISOString(),
  };
}
