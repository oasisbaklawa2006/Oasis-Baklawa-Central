import type { DraftOrderReadinessDimension } from "@/lib/wa-governance/draftOrderExtractionTypes";
import type { ReadinessValidationResult } from "./types";

const REQUIRED_DIMENSIONS = [
  "client",
  "product",
  "quantity",
  "address",
  "payment_terms",
] as const;

const MIN_APPROVAL_SCORE = 40;

export function validateSalesOrderDraftReadiness(
  dimensions: DraftOrderReadinessDimension[],
): ReadinessValidationResult {
  const byKey = new Map(dimensions.map((dimension) => [dimension.dimension, dimension]));
  const blockingDimensions: DraftOrderReadinessDimension[] = [];
  const messages: string[] = [];

  for (const key of REQUIRED_DIMENSIONS) {
    const dimension = byKey.get(key);
    if (!dimension) {
      messages.push(`Missing readiness dimension: ${key}.`);
      continue;
    }
    if (dimension.status === "missing" || dimension.score < MIN_APPROVAL_SCORE) {
      blockingDimensions.push(dimension);
      messages.push(
        `${key} is not ready (${dimension.score}% — ${dimension.status}). ${dimension.explanation}`,
      );
    }
  }

  return {
    valid: blockingDimensions.length === 0 && messages.length === 0,
    blockingDimensions,
    messages,
  };
}

export function canTransitionToApproved(
  dimensions: DraftOrderReadinessDimension[],
): ReadinessValidationResult {
  return validateSalesOrderDraftReadiness(dimensions);
}
