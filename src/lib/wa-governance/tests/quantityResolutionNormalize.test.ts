import { describe, expect, it } from "vitest";
import { normalizeQuantityFromCatalogue } from "@/lib/wa-governance/quantityResolutionNormalize";
import { convertToKgFromCatalogue } from "@/lib/unit-conversion";

describe("quantityResolutionNormalize", () => {
  const bulkProduct = {
    category: "Bulk Sweets",
    uom: "Kg",
    weight_per_box_kg: 6,
    grams_per_piece: 22,
    packs_per_master_carton: 9,
    settlement_unit: "KG",
  };

  const readyProduct = {
    category: "Ready Packs",
    uom: "Pc",
    pcs_per_master_carton: 24,
    settlement_unit: "PCS",
  };

  it("normalizes cartons to catalogue pcs using pcs_per_master_carton", () => {
    expect(normalizeQuantityFromCatalogue(3, "cartons", readyProduct)).toEqual({
      normalizedValue: 72,
      normalizedUnit: "pcs",
      normalizationReason:
        "Catalogue packs per carton (24) converts 3 cartons to 72 pcs",
    });
  });

  it("normalizes tins to kg using catalogue weight_per_box_kg", () => {
    expect(normalizeQuantityFromCatalogue(2, "tins", bulkProduct)).toEqual({
      normalizedValue: 12,
      normalizedUnit: "kg",
      normalizationReason: "Catalogue weight profile converts 2 tins to 12 kg",
    });
  });

  it("returns raw-only when catalogue conversion fields are missing", () => {
    expect(normalizeQuantityFromCatalogue(50, "tins", { category: "Bulk Sweets", uom: "Kg" })).toBeNull();
    expect(normalizeQuantityFromCatalogue(3, "cartons", readyProduct)).not.toBeNull();
    expect(
      normalizeQuantityFromCatalogue(3, "cartons", { category: "Ready Packs", uom: "Pc" }),
    ).toBeNull();
  });

  it("does not apply bulk default fallbacks from convertToKgFromCatalogue", () => {
    expect(
      convertToKgFromCatalogue(1, "box", { category: "Bulk Sweets", weight_per_box_kg: null }),
    ).toBeNull();
    expect(
      convertToKgFromCatalogue(1, "pcs", { category: "Bulk Sweets", grams_per_piece: null }),
    ).toBeNull();
  });
});
