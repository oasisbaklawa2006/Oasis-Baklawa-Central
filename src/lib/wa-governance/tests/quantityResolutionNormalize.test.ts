import { describe, expect, it } from "vitest";
import {
  applyCatalogueConversionToEntry,
  resolveQuantityCandidates,
} from "@/lib/wa-governance/fetchQuantityResolution";
import { normalizeQuantityFromCatalogue } from "@/lib/wa-governance/quantityResolutionNormalize";
import {
  BULK_DEFAULT_BOX_KG,
  BULK_DEFAULT_GRAMS_PER_PIECE,
  convertToKg,
  convertToKgFromCatalogue,
} from "@/lib/unit-conversion";

describe("quantityResolutionNormalize hardening", () => {
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

  it("50 tins converts using products.weight_per_box_kg", () => {
    expect(normalizeQuantityFromCatalogue(50, "tins", bulkProduct)).toEqual({
      normalizedQuantity: 300,
      normalizedUnit: "kg",
      conversionSource: "products.weight_per_box_kg",
    });
  });

  it("100 pcs converts using products.grams_per_piece", () => {
    expect(normalizeQuantityFromCatalogue(100, "pcs", bulkProduct)).toEqual({
      normalizedQuantity: 2.2,
      normalizedUnit: "kg",
      conversionSource: "products.grams_per_piece",
    });
  });

  it("3 cartons converts using products.pcs_per_master_carton", () => {
    expect(normalizeQuantityFromCatalogue(3, "cartons", readyProduct)).toEqual({
      normalizedQuantity: 72,
      normalizedUnit: "pcs",
      conversionSource: "products.pcs_per_master_carton",
    });
  });

  it("3 cases converts using the same catalogue carton fields as cartons", () => {
    expect(normalizeQuantityFromCatalogue(3, "cases", readyProduct)).toEqual({
      normalizedQuantity: 72,
      normalizedUnit: "pcs",
      conversionSource: "products.pcs_per_master_carton",
    });
  });

  it("gates catalogue conversion per line against product best match", async () => {
    const baklavaProfile = {
      category: "Baklava",
      uom: "Pc",
      weight_per_box_kg: 6,
      pcs_per_master_carton: 24,
    };

    const single = await resolveQuantityCandidates(
      { messageText: "Need 50 tins", stitchedPlainText: "", productBestMatchName: "Assorted Baklava 400gm Tin" },
      null,
      baklavaProfile,
    );
    expect(single.quantities[0]?.conversionStatus).toBe("resolved");

    const multiBaklava = await resolveQuantityCandidates(
      {
        messageText: "50 Baklava tins and 25 Mamoul trays",
        stitchedPlainText: "",
        productBestMatchName: "Assorted Baklava 400gm Tin",
      },
      null,
      baklavaProfile,
    );
    const baklavaLine = multiBaklava.quantities.find((entry) => entry.productHint === "Baklava");
    const mamoulLine = multiBaklava.quantities.find((entry) => entry.productHint === "Mamoul");
    expect(baklavaLine?.conversionStatus).toBe("resolved");
    expect(mamoulLine?.conversionStatus).toBe("unknown");
    expect(mamoulLine?.normalizedQuantity).toBeUndefined();

    const multiNoHint = await resolveQuantityCandidates(
      {
        messageText: "50 tins and 25 trays",
        stitchedPlainText: "",
        productBestMatchName: "Assorted Baklava 400gm Tin",
      },
      null,
      baklavaProfile,
    );
    expect(multiNoHint.quantities.every((entry) => entry.conversionStatus === "unknown")).toBe(true);
  });

  it("returns unknown when catalogue conversion fields are missing", () => {
    expect(normalizeQuantityFromCatalogue(50, "tins", { category: "Bulk Sweets", uom: "Kg" })).toBeNull();
    expect(
      normalizeQuantityFromCatalogue(3, "cartons", { category: "Ready Packs", uom: "Pc" }),
    ).toBeNull();

    const entry = applyCatalogueConversionToEntry(
      {
        rawQuantity: 50,
        rawUnit: "tins",
        conversionStatus: "unknown",
        productHint: null,
        confidence: 98,
        reasons: [],
        band: "auto_highlight",
      },
      { category: "Bulk Sweets", uom: "Kg" },
    );
    expect(entry.conversionStatus).toBe("unknown");
    expect(entry.normalizedQuantity).toBeUndefined();
    expect(entry.conversionSource).toBeUndefined();
  });

  it("does not use bulk default fallbacks or hardcoded defaults", () => {
    const missingFields = { category: "Bulk Sweets", uom: "Kg" };

    expect(convertToKgFromCatalogue(50, "tins", missingFields)).toBeNull();
    expect(convertToKg(50, "tins", missingFields)).toBe(300);
    expect(convertToKg(50, "tins", missingFields)).toBe(50 * BULK_DEFAULT_BOX_KG);

    expect(convertToKgFromCatalogue(100, "pcs", missingFields)).toBeNull();
    expect(convertToKg(100, "pcs", missingFields)).toBe((100 * BULK_DEFAULT_GRAMS_PER_PIECE) / 1000);
  });

  it("applyCatalogueConversionToEntry returns resolved payload shape", () => {
    const resolved = applyCatalogueConversionToEntry(
      {
        rawQuantity: 3,
        rawUnit: "cartons",
        conversionStatus: "unknown",
        productHint: null,
        confidence: 98,
        reasons: ["Detected explicit quantity 3 cartons in message"],
        band: "auto_highlight",
      },
      readyProduct,
    );

    expect(resolved).toMatchObject({
      rawQuantity: 3,
      rawUnit: "cartons",
      normalizedQuantity: 72,
      normalizedUnit: "pcs",
      conversionSource: "products.pcs_per_master_carton",
      conversionStatus: "resolved",
    });
  });

  it("resolveQuantityCandidates applies catalogue conversion when product profile is supplied", async () => {
    const result = await resolveQuantityCandidates(
      {
        messageText: "Need 50 tins",
        stitchedPlainText: "",
        productBestMatchName: "Assorted Baklawa 400gm Tin",
      },
      null,
      bulkProduct,
    );

    expect(result.quantities[0]).toMatchObject({
      rawQuantity: 50,
      rawUnit: "tins",
      normalizedQuantity: 300,
      normalizedUnit: "kg",
      conversionSource: "products.weight_per_box_kg",
      conversionStatus: "resolved",
    });
  });
});
