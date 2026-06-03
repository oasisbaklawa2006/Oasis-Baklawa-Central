import type {
  ClientResolutionConfidenceBand,
  ClientResolutionResult,
} from "./clientResolutionTypes";

const BADGE_BASE = "inline-flex items-center rounded-md border px-2 py-0.5 text-xs font-medium";

export function clientResolutionBandLabel(band: ClientResolutionConfidenceBand): string {
  switch (band) {
    case "auto_highlight":
      return "High confidence — auto-highlight";
    case "suggested":
      return "Suggested match";
    default:
      return "Needs clarification";
  }
}

export function clientResolutionBandClassName(band: ClientResolutionConfidenceBand): string {
  switch (band) {
    case "auto_highlight":
      return `${BADGE_BASE} border-emerald-200 bg-emerald-50 text-emerald-900`;
    case "suggested":
      return `${BADGE_BASE} border-blue-200 bg-blue-50 text-blue-900`;
    default:
      return `${BADGE_BASE} border-amber-200 bg-amber-50 text-amber-900`;
  }
}

export function summarizeClientResolution(result: ClientResolutionResult): {
  likelyClient: string;
  likelyOwner: string;
  confidenceLabel: string;
} {
  const best = result.bestMatch;
  if (!best) {
    return {
      likelyClient: "No likely client identified",
      likelyOwner: "Unknown",
      confidenceLabel: "—",
    };
  }
  return {
    likelyClient: best.companyName,
    likelyOwner: best.ownerName ?? "No account manager assigned",
    confidenceLabel: `${best.confidence}%`,
  };
}
