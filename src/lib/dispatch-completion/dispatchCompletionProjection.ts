import {
  buildCompletionBlockingReasons,
  buildCompletionRecommendation,
  buildCompletionWarnings,
  deriveDispatchCompletionStatus,
} from "./dispatchCompletionEligibility";
import type { DispatchCompletionInput, DispatchCompletionProjection } from "./dispatchCompletionTypes";

export function projectDispatchCompletion(input: DispatchCompletionInput): DispatchCompletionProjection {
  const completionStatus = deriveDispatchCompletionStatus(input);
  const blockingReasons = buildCompletionBlockingReasons(input);
  const warnings = buildCompletionWarnings(completionStatus);

  return {
    orderId: input.orderId,
    completionStatus,
    blockingReasons,
    warnings,
    completionRecommendation: buildCompletionRecommendation(completionStatus),
    readinessStatus: input.readinessStatus,
    financeSignal: input.financeSignal,
    financeReleaseStatus: input.financeReleaseStatus,
    evaluatedAt: new Date().toISOString(),
  };
}
