import { describe, expect, it } from "vitest";
import { extractQuantityResolutionTextSignals } from "@/lib/wa-governance/quantityResolutionSignals";
import {
  confidenceBandFromQuantityScore,
  QUANTITY_SIGNAL_WEIGHTS,
  scoreQuantityResolutionCandidates,
} from "@/lib/wa-governance/quantityResolutionScoring";

describe("quantityResolutionScoring", () => {
  it("scores explicit quantity with unit at auto-highlight band", () => {
    const signals = extractQuantityResolutionTextSignals("Need 50 boxes", "");
    const result = scoreQuantityResolutionCandidates({ signals });

    expect(result.quantities[0]?.confidence).toBe(
      Math.round(QUANTITY_SIGNAL_WEIGHTS.explicitWithUnit * 100),
    );
    expect(result.band).toBe("auto_highlight");
  });

  it("scores explicit quantity only at suggested band", () => {
    const signals = extractQuantityResolutionTextSignals("Need 50 please confirm", "");
    const result = scoreQuantityResolutionCandidates({ signals });

    expect(result.quantities[0]?.confidence).toBe(
      Math.round(QUANTITY_SIGNAL_WEIGHTS.explicitQtyOnly * 100),
    );
    expect(result.band).toBe("suggested");
  });

  it("scores word quantities below clarification threshold", () => {
    const signals = extractQuantityResolutionTextSignals("half dozen", "");
    const result = scoreQuantityResolutionCandidates({ signals });

    expect(result.quantities[0]?.confidence).toBeLessThan(70);
    expect(result.band).toBe("needs_clarification");
  });

  it("does not duplicate the same quantity signal twice", () => {
    const signals = extractQuantityResolutionTextSignals("Need 50 boxes and 50 boxes", "");
    const result = scoreQuantityResolutionCandidates({ signals });
    expect(result.quantities).toHaveLength(1);
  });

  it("returns multiple scored quantities for multi-product messages", () => {
    const signals = extractQuantityResolutionTextSignals(
      "50 Baklava tins and 25 Mamoul trays",
      "",
    );
    const result = scoreQuantityResolutionCandidates({ signals });

    expect(result.quantities).toHaveLength(2);
    expect(result.quantities[0]?.productHint).toBeTruthy();
    expect(result.quantities[1]?.productHint).toBeTruthy();
  });

  it("maps confidence bands at 95 and 70 thresholds", () => {
    expect(confidenceBandFromQuantityScore(98)).toBe("auto_highlight");
    expect(confidenceBandFromQuantityScore(80)).toBe("suggested");
    expect(confidenceBandFromQuantityScore(62)).toBe("needs_clarification");
  });
});
