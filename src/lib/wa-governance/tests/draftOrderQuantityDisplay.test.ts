import { describe, expect, it } from "vitest";
import {
  formatDraftLineQuantityLabel,
  resolveEditableDraftLineQuantity,
} from "@/lib/wa-governance/draftOrderQuantityDisplay";
import type { DraftOrderLineItem } from "@/lib/wa-governance/draftOrderExtractionTypes";

const lineWithUnknownQty: DraftOrderLineItem = {
  lineIndex: 0,
  productId: "prod-1",
  productName: "Premium Baklawa Box",
  sku: "BKW-500",
  rawQuantity: null,
  rawUnit: null,
  normalizedQuantity: null,
  normalizedUnit: null,
  productConfidence: 80,
  quantityConfidence: 0,
  productBand: "suggested",
  quantityBand: "needs_clarification",
  originalTextSpan: null,
  conversionExplanation: null,
  resolutionReasons: [],
};

describe("draftOrderQuantityDisplay", () => {
  it("never formats unknown quantity as a confirmed count", () => {
    expect(formatDraftLineQuantityLabel(lineWithUnknownQty)).toBe("Qty pending clarification");
    expect(formatDraftLineQuantityLabel(lineWithUnknownQty)).not.toMatch(/Qty 1/);
  });

  it("resolves editable quantity only from explicit operator or AI values", () => {
    expect(resolveEditableDraftLineQuantity(lineWithUnknownQty, {}, {})).toBeNull();
    expect(resolveEditableDraftLineQuantity(lineWithUnknownQty, { 0: 7 }, {})).toBe(7);
  });
});
