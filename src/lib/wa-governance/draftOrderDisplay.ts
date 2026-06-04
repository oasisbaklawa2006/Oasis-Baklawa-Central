import type { ExtractedDraftOrder } from "./draftOrderExtractionTypes";

export function draftOrderReadinessBandClass(score: number): string {
  if (score >= 75) return "bg-emerald-100 text-emerald-900 border-emerald-200";
  if (score >= 40) return "bg-amber-100 text-amber-900 border-amber-200";
  return "bg-red-100 text-red-900 border-red-200";
}

export function draftOrderReadinessBandLabel(score: number): string {
  if (score >= 75) return "Ready";
  if (score >= 40) return "Partial";
  return "Needs work";
}

export function draftOrderDimensionLabel(dimension: string): string {
  switch (dimension) {
    case "client":
      return "Client";
    case "product":
      return "Product";
    case "quantity":
      return "Quantity";
    case "address":
      return "Address";
    case "payment_terms":
      return "Payment terms";
    default:
      return dimension;
  }
}

export function summarizeDraftOrder(draft: ExtractedDraftOrder): {
  headline: string;
  clientLabel: string;
  lineCount: number;
  readinessLabel: string;
} {
  const clientLabel = draft.client.companyName ?? "Unresolved client";
  const lineCount = draft.lineItems.length;
  return {
    headline:
      draft.status === "ready"
        ? `Draft preview · ${lineCount} line${lineCount === 1 ? "" : "s"}`
        : "Draft preview pending resolution",
    clientLabel,
    lineCount,
    readinessLabel: `${draft.readiness.overallScore}% · ${draftOrderReadinessBandLabel(draft.readiness.overallScore)}`,
  };
}
