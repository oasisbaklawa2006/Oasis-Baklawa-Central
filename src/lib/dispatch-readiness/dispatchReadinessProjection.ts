import { buildBlockingReasons, buildMissingRequirements, buildSafeStaffRecommendation, buildWarnings } from "./dispatchReadinessChecklist";
import { deriveGateEligibility, deriveReadinessStatus, promoteToGateEligibleIfEligible } from "./dispatchGateEligibility";
import { detectDispatchExceptionsFromRules } from "./dispatchExceptionDetection";
import { evaluateAllDimensions } from "./dispatchReadinessRules";
import type {
  DispatchReadinessInput,
  DispatchReadinessProjection,
} from "./dispatchReadinessTypes";

export function projectDispatchReadiness(input: DispatchReadinessInput): DispatchReadinessProjection {
  const results = evaluateAllDimensions(input);
  const openExceptions = detectDispatchExceptionsFromRules(input, results);
  const hasOpenExceptions = openExceptions.length > 0;

  let readinessStatus = deriveReadinessStatus(results, hasOpenExceptions);
  const gateEligibility = deriveGateEligibility(readinessStatus, results, hasOpenExceptions);
  readinessStatus = promoteToGateEligibleIfEligible(readinessStatus, gateEligibility);

  const missingRequirements = buildMissingRequirements(results);
  const warnings = buildWarnings(results);
  const blockingReasons = buildBlockingReasons(missingRequirements, openExceptions);

  const dimensionResults = Object.fromEntries(
    results.map((r) => [r.dimension, r.satisfied]),
  ) as DispatchReadinessProjection["dimensionResults"];

  return {
    orderId: input.orderId,
    readinessStatus,
    gateEligibility,
    dimensionResults,
    missingRequirements,
    blockingReasons,
    warnings,
    safeStaffRecommendation: buildSafeStaffRecommendation(readinessStatus, gateEligibility),
    openExceptions,
    evaluatedAt: new Date().toISOString(),
  };
}
