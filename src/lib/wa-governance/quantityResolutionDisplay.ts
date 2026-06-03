import type {
  QuantityResolutionConfidenceBand,
  QuantityResolutionEntry,
  QuantityResolutionResult,
} from "./quantityResolutionTypes";

const BADGE_BASE = "inline-flex items-center rounded-md border px-2 py-0.5 text-xs font-medium";

export function quantityResolutionBandLabel(band: QuantityResolutionConfidenceBand): string {
  switch (band) {
    case "auto_highlight":
      return "High confidence — auto-highlight";
    case "suggested":
      return "Suggested quantity";
    default:
      return "Needs clarification";
  }
}

export function quantityResolutionBandClassName(band: QuantityResolutionConfidenceBand): string {
  switch (band) {
    case "auto_highlight":
      return `${BADGE_BASE} border-emerald-200 bg-emerald-50 text-emerald-900`;
    case "suggested":
      return `${BADGE_BASE} border-blue-200 bg-blue-50 text-blue-900`;
    default:
      return `${BADGE_BASE} border-amber-200 bg-amber-50 text-amber-900`;
  }
}

export function formatQuantityUnitLabel(unit: string | null): string {
  if (!unit) return "—";
  return unit;
}

export function formatNormalizedQuantityLabel(
  value: number | null | undefined,
  unit: string | null | undefined,
): string {
  if (value == null || !unit) return "—";
  return `${value} ${unit}`;
}

export function summarizeQuantityResolution(result: QuantityResolutionResult): {
  primaryQuantity: string;
  confidenceLabel: string;
} {
  const top = result.quantities[0];
  if (!top) {
    return {
      primaryQuantity: "No quantities detected",
      confidenceLabel: "—",
    };
  }

  const unitLabel = top.rawUnit ? ` ${top.rawUnit}` : "";
  const hintLabel = top.productHint ? ` (${top.productHint})` : "";
  return {
    primaryQuantity: `${top.rawQuantity}${unitLabel}${hintLabel}`,
    confidenceLabel: `${top.confidence}%`,
  };
}

export function quantityResolutionAlternatives(
  result: QuantityResolutionResult,
): QuantityResolutionEntry[] {
  return result.quantities.slice(1, 4);
}
