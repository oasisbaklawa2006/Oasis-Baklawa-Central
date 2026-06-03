import { describe, expect, it } from "vitest";
import {
  buildQuantityResolutionCombinedText,
  extractQuantityResolutionTextSignals,
  normalizeQuantityUnit,
} from "@/lib/wa-governance/quantityResolutionSignals";

describe("quantityResolutionSignals", () => {
  it("extracts explicit quantity and unit from common order phrases", () => {
    const signals = extractQuantityResolutionTextSignals("Need 50 boxes", "");
    expect(signals.matches).toHaveLength(1);
    expect(signals.matches[0]).toMatchObject({
      value: 50,
      unit: "boxes",
      kind: "explicit_with_unit",
    });
  });

  it("extracts multiple quantity blocks with product hints", () => {
    const signals = extractQuantityResolutionTextSignals(
      "Need 50 Baklava tins and 25 Mamoul trays",
      "",
    );

    expect(signals.matches).toHaveLength(2);
    expect(signals.matches[0]).toMatchObject({
      value: 50,
      unit: "tins",
      productHint: "Baklava",
    });
    expect(signals.matches[1]).toMatchObject({
      value: 25,
      unit: "trays",
      productHint: "Mamoul",
    });
  });

  it("extracts quantity with trailing product phrase", () => {
    const signals = extractQuantityResolutionTextSignals("3 cartons Turkish Delight", "");
    expect(signals.matches.some((match) => match.value === 3 && match.unit === "cartons")).toBe(
      true,
    );
  });

  it("normalizes unit aliases", () => {
    expect(normalizeQuantityUnit("box")).toBe("boxes");
    expect(normalizeQuantityUnit("TIN")).toBe("tins");
    expect(normalizeQuantityUnit("pc")).toBe("pcs");
  });

  it("does not treat phone numbers, GSTIN, or order refs as quantities", () => {
    const signals = extractQuantityResolutionTextSignals(
      "Call 9876543210 GST 22AAAAA0000A1Z5 order SO-12345",
      "",
    );
    expect(signals.matches).toHaveLength(0);
  });

  it("extracts word quantities with lower-confidence kinds", () => {
    const signals = extractQuantityResolutionTextSignals("Need 2 dozen and half dozen pair", "");
    expect(signals.matches.some((match) => match.kind === "word_quantity" && match.value === 24)).toBe(
      true,
    );
    expect(signals.matches.some((match) => match.value === 6)).toBe(true);
    expect(signals.matches.some((match) => match.value === 2)).toBe(true);
  });

  it("builds combined text from snippet and stitched body", () => {
    expect(buildQuantityResolutionCombinedText("Need 25 tins", "Follow-up note")).toBe(
      "Need 25 tins\nFollow-up note",
    );
  });
});
