import { describe, expect, it } from "vitest";
import {
  applyCatalogueConversionToEntry,
  resolveQuantityCandidates,
} from "@/lib/wa-governance/fetchQuantityResolution";
import { normalizeQuantityFromCatalogue, shouldApplyCatalogueConversionToEntry } from "@/lib/wa-governance/quantityResolutionNormalize";
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

  const baklavaProfile = {
    category: "Baklava",
    uom: "Pc",
    weight_per_box_kg: 6,
    pcs_per_master_carton: 24,
  };

  it("gates catalogue conversion per line against product best match", async () => {
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

  it("allows catalogue conversion for alias-variant hints matching product best match", async () => {
    const baklawaProductProfile = {
      category: "Baklava",
      uom: "Pc",
      weight_per_box_kg: 6,
      pcs_per_master_carton: 24,
    };

    const baklavaHintBaklawaProduct = await resolveQuantityCandidates(
      {
        messageText: "50 Baklava tins and 25 Mamoul trays",
        stitchedPlainText: "",
        productBestMatchName: "Assorted Baklawa 400gm Tin",
      },
      null,
      baklawaProductProfile,
    );
    expect(
      baklavaHintBaklawaProduct.quantities.find((entry) => entry.productHint === "Baklava")?.conversionStatus,
    ).toBe("resolved");

    const baklawaHintBaklavaProduct = await resolveQuantityCandidates(
      {
        messageText: "50 Baklawa tins and 25 Mamoul trays",
        stitchedPlainText: "",
        productBestMatchName: "Assorted Baklava 400gm Tin",
      },
      null,
      baklavaProfile,
    );
    const baklawaSpelledLine = baklawaHintBaklavaProduct.quantities.find(
      (entry) => entry.rawQuantity === 50 && entry.rawUnit === "tins",
    );
    expect(baklawaSpelledLine?.conversionStatus).toBe("resolved");
    expect(
      baklawaHintBaklavaProduct.quantities.find((entry) => entry.productHint === "Mamoul")?.conversionStatus,
    ).toBe("unknown");
  });

  it("shouldApplyCatalogueConversionToEntry uses WA-05A alias identity policy", () => {
    const baseEntry = {
      rawQuantity: 50,
      rawUnit: "tins",
      conversionStatus: "unknown" as const,
      confidence: 90,
      reasons: [],
      band: "auto_highlight" as const,
    };

    expect(
      shouldApplyCatalogueConversionToEntry(
        { ...baseEntry, productHint: "Baklava" },
        "Assorted Baklawa 400gm Tin",
        2,
      ),
    ).toBe(true);
    expect(
      shouldApplyCatalogueConversionToEntry(
        { ...baseEntry, productHint: "Baklawa" },
        "Assorted Baklava 400gm Tin",
        2,
      ),
    ).toBe(true);
    expect(
      shouldApplyCatalogueConversionToEntry(
        { ...baseEntry, productHint: "Mamoul" },
        "Assorted Baklava 400gm Tin",
        2,
      ),
    ).toBe(false);
    expect(
      shouldApplyCatalogueConversionToEntry(
        { ...baseEntry, productHint: null },
        "Assorted Baklava 400gm Tin",
        2,
      ),
    ).toBe(false);
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

  describe("catalogue conversion branch matrix", () => {
    const bulkCartonProduct = {
      category: "Bulk Sweets",
      uom: "Kg",
      packs_per_master_carton: 9,
      packs_per_carton: 6,
    };

    const premiumProduct = {
      category: "Premium Luxury Gifts",
      uom: "Pc",
      pcs_per_master_carton: 12,
    };

    it("bulk cartons normalize to packs via packs_per_master_carton", () => {
      expect(normalizeQuantityFromCatalogue(2, "cartons", bulkCartonProduct)).toEqual({
        normalizedQuantity: 18,
        normalizedUnit: "packs",
        conversionSource: "products.packs_per_master_carton",
      });
    });

    it("bulk cartons fall back to packs_per_carton when master count is missing", () => {
      expect(
        normalizeQuantityFromCatalogue(2, "cartons", {
          category: "Bulk Sweets",
          uom: "Kg",
          packs_per_carton: 6,
        }),
      ).toEqual({
        normalizedQuantity: 12,
        normalizedUnit: "packs",
        conversionSource: "products.packs_per_carton",
      });
    });

    it("premium_pc cartons normalize to pcs via pcs_per_master_carton", () => {
      expect(normalizeQuantityFromCatalogue(2, "cartons", premiumProduct)).toEqual({
        normalizedQuantity: 24,
        normalizedUnit: "pcs",
        conversionSource: "products.pcs_per_master_carton",
      });
    });

    it("treats ctn and ctns as carton-equivalent units", () => {
      expect(normalizeQuantityFromCatalogue(2, "ctn", readyProduct)).toEqual({
        normalizedQuantity: 48,
        normalizedUnit: "pcs",
        conversionSource: "products.pcs_per_master_carton",
      });
      expect(normalizeQuantityFromCatalogue(2, "ctns", readyProduct)).toEqual({
        normalizedQuantity: 48,
        normalizedUnit: "pcs",
        conversionSource: "products.pcs_per_master_carton",
      });
    });

    it("kg and gm normalize through catalogue weight identity paths", () => {
      expect(normalizeQuantityFromCatalogue(5, "kg", bulkProduct)).toEqual({
        normalizedQuantity: 5,
        normalizedUnit: "kg",
        conversionSource: "catalogue.kg_identity",
      });
      expect(normalizeQuantityFromCatalogue(500, "gm", bulkProduct)).toEqual({
        normalizedQuantity: 0.5,
        normalizedUnit: "kg",
        conversionSource: "catalogue.gm_to_kg",
      });
    });

    it("rejects non-positive quantities and zero catalogue fields", () => {
      expect(normalizeQuantityFromCatalogue(0, "tins", bulkProduct)).toBeNull();
      expect(normalizeQuantityFromCatalogue(-3, "cartons", readyProduct)).toBeNull();
      expect(
        normalizeQuantityFromCatalogue(3, "cartons", {
          category: "Ready Packs",
          uom: "Pc",
          pcs_per_master_carton: 0,
        }),
      ).toBeNull();
    });
  });

  describe("conversion status invariants", () => {
    it("strips normalized fields when gating blocks multi-line conversion", async () => {
      const result = await resolveQuantityCandidates(
        {
          messageText: "50 tins and 25 trays",
          stitchedPlainText: "",
          productBestMatchName: "Assorted Baklava 400gm Tin",
        },
        null,
        baklavaProfile,
      );

      for (const entry of result.quantities) {
        expect(entry.conversionStatus).toBe("unknown");
        expect(entry.normalizedQuantity).toBeUndefined();
        expect(entry.normalizedUnit).toBeUndefined();
        expect(entry.conversionSource).toBeUndefined();
      }
    });

    it("strips stale normalized fields when catalogue conversion fails", () => {
      const entry = applyCatalogueConversionToEntry(
        {
          rawQuantity: 50,
          rawUnit: "tins",
          conversionStatus: "resolved",
          normalizedQuantity: 999,
          normalizedUnit: "kg",
          conversionSource: "stale.source",
          productHint: null,
          confidence: 98,
          reasons: [],
          band: "auto_highlight",
        },
        { category: "Bulk Sweets", uom: "Kg" },
      );

      expect(entry.conversionStatus).toBe("unknown");
      expect(entry.normalizedQuantity).toBeUndefined();
      expect(entry.normalizedUnit).toBeUndefined();
      expect(entry.conversionSource).toBeUndefined();
    });

    it("resolved entries always include normalizedQuantity, normalizedUnit, and conversionSource", () => {
      const resolved = applyCatalogueConversionToEntry(
        {
          rawQuantity: 50,
          rawUnit: "tins",
          conversionStatus: "unknown",
          productHint: null,
          confidence: 98,
          reasons: [],
          band: "auto_highlight",
        },
        bulkProduct,
      );

      expect(resolved.conversionStatus).toBe("resolved");
      expect(resolved.normalizedQuantity).toBeTypeOf("number");
      expect(resolved.normalizedUnit).toBeTruthy();
      expect(resolved.conversionSource).toMatch(/^products\.|^catalogue\./);
    });
  });
});
