import { extractQuantityResolutionTextSignals } from "./quantityResolutionSignals";
import { scoreQuantityResolutionCandidates } from "./quantityResolutionScoring";
import type { QuantityResolutionInput, QuantityResolutionResult } from "./quantityResolutionTypes";

/**
 * Read-only quantity resolution for operator inbox (WA-06A).
 * Pure message parsing — no database reads or mutations.
 */
export function resolveQuantityCandidates(
  input: QuantityResolutionInput,
): QuantityResolutionResult {
  const signals = extractQuantityResolutionTextSignals(
    input.messageText,
    input.stitchedPlainText,
  );
  return scoreQuantityResolutionCandidates({ signals });
}

export async function fetchQuantityResolution(
  input: QuantityResolutionInput,
): Promise<QuantityResolutionResult> {
  return resolveQuantityCandidates(input);
}
