import type { DraftOrderLineItem } from "./draftOrderExtractionTypes";

/** Operator-safe quantity label — never implies a confirmed count when unknown. */
export function formatDraftLineQuantityLabel(line: DraftOrderLineItem): string {
  const qty = line.normalizedQuantity ?? line.rawQuantity;
  if (qty == null) {
    return "Qty pending clarification";
  }
  const unit = line.normalizedUnit ?? line.rawUnit ?? "unit";
  return `Qty ${qty} ${unit}`;
}

export function resolveEditableDraftLineQuantity(
  line: DraftOrderLineItem,
  lineQuantities: Record<number, number>,
  localEdits: Record<number, number>,
): number | null {
  if (Object.prototype.hasOwnProperty.call(lineQuantities, line.lineIndex)) {
    return lineQuantities[line.lineIndex];
  }
  if (Object.prototype.hasOwnProperty.call(localEdits, line.lineIndex)) {
    return localEdits[line.lineIndex];
  }
  const resolved = line.normalizedQuantity ?? line.rawQuantity;
  return resolved ?? null;
}
