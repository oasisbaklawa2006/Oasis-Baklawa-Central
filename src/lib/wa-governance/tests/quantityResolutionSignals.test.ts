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

  it("extracts direct weight-product lines from fragmented B2B orders", () => {
    const signals = extractQuantityResolutionTextSignals(
      "Hi I want to place an order\n5kg pyramid\n10 kg finger\n2 box chocolates",
      "",
    );
    expect(signals.matches).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ value: 5, unit: "kg", productHint: "pyramid" }),
        expect.objectContaining({ value: 10, unit: "kg", productHint: "finger" }),
        expect.objectContaining({ value: 2, unit: "boxes" }),
      ]),
    );
  });

  it("normalizes unit aliases", () => {
    expect(normalizeQuantityUnit("box")).toBe("boxes");
    expect(normalizeQuantityUnit("TIN")).toBe("tins");
    expect(normalizeQuantityUnit("pc")).toBe("pcs");
  });

  it("does not extract partial digits or dates as qty-only quantities", () => {
    expect(extractQuantityResolutionTextSignals("Need 50 boxes", "Need 50 boxes").matches).toHaveLength(1);
    expect(extractQuantityResolutionTextSignals("order 25/12/2026", "").matches).toHaveLength(0);
    expect(extractQuantityResolutionTextSignals("Need 50 please confirm", "").matches).toHaveLength(1);
    expect(extractQuantityResolutionTextSignals("Need 50 please confirm", "").matches[0]?.kind).toBe(
      "explicit_qty_only",
    );
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

  // Gate D — non-order conversational text must never invent a commercial quantity.
  // Physical smoke test observed "When will I receive my order" producing a false
  // quantity=1 hint at 78% confidence; the isolated phrase alone does not reproduce
  // it (see the cross-line contamination case below for the actual mechanism), but
  // every non-order status/chit-chat phrase must independently yield zero matches.
  describe("non-order conversational text never invents a quantity", () => {
    const nonOrderPhrases = [
      "When will I receive my order",
      "Where is my order?",
      "Please update me",
      "Send it tomorrow",
      "Call me",
      "When will my order arrive",
      "Has my order been dispatched",
      "Any update on my order please",
    ];

    it.each(nonOrderPhrases)("produces zero quantity matches for: %s", (phrase) => {
      const signals = extractQuantityResolutionTextSignals(phrase);
      expect(signals.matches).toHaveLength(0);
    });

    it("does not treat colon- or hyphen-separated order/client-code references as quantities", () => {
      for (const text of [
        "order number: 12345",
        "order number-12345",
        "client code: 12345",
        "client code-12345",
      ]) {
        expect(extractQuantityResolutionTextSignals(text).matches).toHaveLength(0);
      }
    });
  });

  it("regression: a bare number starting the NEXT line is not attributed to an unrelated keyword on the previous line", () => {
    // Reproduces the exact physically observed defect: "...my order" ends one line,
    // an unrelated numbered follow-up starts the next. Because `\s+` matches `\n`,
    // the keyword-to-digit gap used to span the line break and misread the
    // follow-up's leading digit as an explicit quantity for "order".
    const signals = extractQuantityResolutionTextSignals(
      "When will I receive my order\n1 more question about delivery",
    );
    expect(signals.matches).toHaveLength(0);
  });

  it("regression: a same-packet order line followed by an unrelated status-enquiry line only attributes quantity to the order line", () => {
    const signals = extractQuantityResolutionTextSignals(
      "Need 5 boxes cashew nuts\nWhen will I receive my order",
    );
    expect(signals.matches).toHaveLength(1);
    expect(signals.matches[0]).toMatchObject({ value: 5, unit: "boxes" });
  });

  it("still extracts a keyword-qualified quantity when the keyword and digit share a line", () => {
    expect(extractQuantityResolutionTextSignals("I need 2 boxes").matches[0]).toMatchObject({
      value: 2,
      unit: "boxes",
    });
    expect(extractQuantityResolutionTextSignals("send me 3kg").matches[0]).toMatchObject({
      value: 3,
      unit: "kg",
    });
  });
});
