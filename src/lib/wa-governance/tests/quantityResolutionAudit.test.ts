import { describe, expect, it } from "vitest";
import { resolveQuantityCandidates } from "@/lib/wa-governance/fetchQuantityResolution";
import {
  buildQuantityResolutionResultCacheKey,
  serializeCatalogueQuantityFingerprint,
} from "@/lib/wa-governance/quantityResolutionCacheKey";
import { formatNormalizedQuantityLabel } from "@/lib/wa-governance/quantityResolutionDisplay";
import {
  collapseDuplicateQuantityEntries,
  scoreQuantityResolutionCandidates,
} from "@/lib/wa-governance/quantityResolutionScoring";
import { extractQuantityResolutionTextSignals } from "@/lib/wa-governance/quantityResolutionSignals";
import {
  isCartonEquivalentUnit,
  isCatalogueCartonInnerCountConversion,
  normalizeQuantityFromCatalogue,
} from "@/lib/wa-governance/quantityResolutionNormalize";
import { buildQuantityResolutionRequestKey } from "@/lib/wa-governance/quantityResolutionRequestKey";

const baklavaProfile = {
  category: "Baklava",
  uom: "Pc",
  weight_per_box_kg: 6,
  grams_per_piece: 22,
  pcs_per_master_carton: 24,
};

const baklavaProfileAltCarton = {
  ...baklavaProfile,
  pcs_per_master_carton: 12,
};

describe("quantityResolution pre-merge audit", () => {
  describe("duplicate collapse safety", () => {
    it("preserves two identical quantities for two different products", () => {
      const signals = extractQuantityResolutionTextSignals(
        "50 Baklava tins and 50 Mamoul tins",
        "",
      );
      const result = scoreQuantityResolutionCandidates({ signals });
      expect(result.quantities).toHaveLength(2);
      expect(result.quantities.map((entry) => entry.productHint).sort()).toEqual([
        "Baklava",
        "Mamoul",
      ]);
    });

    it("preserves same product with different units as separate lines", () => {
      const signals = extractQuantityResolutionTextSignals(
        "50 Baklava tins and 50 Baklava pcs",
        "",
      );
      const result = scoreQuantityResolutionCandidates({ signals });
      expect(result.quantities).toHaveLength(2);
      expect(result.quantities.map((entry) => entry.rawUnit).sort()).toEqual(["pcs", "tins"]);
    });

    it("removes only bare shadow duplicate when hinted line exists", () => {
      const shadow = collapseDuplicateQuantityEntries([
        {
          rawQuantity: 2,
          rawUnit: "cases",
          productHint: null,
          conversionStatus: "unknown",
          confidence: 98,
          reasons: [],
          band: "auto_highlight",
        },
        {
          rawQuantity: 2,
          rawUnit: "cases",
          productHint: "Baklava",
          conversionStatus: "unknown",
          confidence: 98,
          reasons: [],
          band: "auto_highlight",
        },
      ]);
      expect(shadow).toHaveLength(1);
      expect(shadow[0]?.productHint).toBe("Baklava");
    });
  });

  describe("non-carton unit protection", () => {
    const nonCartonUnits = ["boxes", "tins", "trays", "packs"] as const;

    for (const unit of nonCartonUnits) {
      it(`never applies carton inner-count fields to ${unit}`, async () => {
        const messageText = `2 Baklava ${unit}`;
        const result = await resolveQuantityCandidates(
          {
            messageText,
            stitchedPlainText: "",
            productBestMatchName: "Assorted Baklava 400gm Tin",
          },
          null,
          baklavaProfile,
        );
        const line = result.quantities[0];
        expect(isCartonEquivalentUnit(line?.rawUnit ?? null)).toBe(false);
        if (line?.conversionSource) {
          expect(isCatalogueCartonInnerCountConversion(line.conversionSource)).toBe(false);
        }
      });
    }
  });

  describe("identity gating", () => {
    it("allows matched single-line alias variant", async () => {
      const result = await resolveQuantityCandidates(
        {
          messageText: "2 Baklawa cases",
          stitchedPlainText: "",
          productBestMatchName: "Assorted Baklava 400gm Tin",
        },
        null,
        baklavaProfile,
      );
      expect(result.quantities[0]?.conversionStatus).toBe("resolved");
    });

    it("blocks mismatched single-line hint", async () => {
      const result = await resolveQuantityCandidates(
        {
          messageText: "2 Mamoul cases",
          stitchedPlainText: "",
          productBestMatchName: "Assorted Baklava 400gm Tin",
        },
        null,
        baklavaProfile,
      );
      expect(result.quantities[0]?.conversionStatus).toBe("unknown");
      expect(result.quantities[0]?.normalizedQuantity).toBeUndefined();
    });
  });

  describe("carton unit/source invariants", () => {
    it("maps packs fields to packs and pcs field to pcs", () => {
      expect(
        normalizeQuantityFromCatalogue(1, "cartons", {
          category: "Bulk Sweets",
          uom: "Kg",
          packs_per_master_carton: 9,
        }),
      ).toMatchObject({
        normalizedUnit: "packs",
        conversionSource: "products.packs_per_master_carton",
      });
      expect(
        normalizeQuantityFromCatalogue(1, "cases", {
          category: "Ready Packs",
          uom: "Pc",
          pcs_per_master_carton: 24,
        }),
      ).toMatchObject({
        normalizedUnit: "pcs",
        conversionSource: "products.pcs_per_master_carton",
      });
    });
  });

  describe("cache key isolation", () => {
    it("changes result cache key when catalogue carton fields change", () => {
      const requestKey = buildQuantityResolutionRequestKey({
        packetId: "p-1",
        contentFingerprint: "fp-1",
        clientResolutionBestMatch: "c-1:Acme",
        productResolutionBestMatch: "product:p-1:Assorted Baklava 400gm Tin",
        identity: { status: "ready", kind: "customer", companyName: "Acme", customerName: "Bob" },
      });

      const keyDefault = buildQuantityResolutionResultCacheKey(requestKey, baklavaProfile);
      const keyAltCarton = buildQuantityResolutionResultCacheKey(requestKey, baklavaProfileAltCarton);
      expect(keyDefault).not.toBe(keyAltCarton);
      expect(serializeCatalogueQuantityFingerprint(baklavaProfile)).not.toBe(
        serializeCatalogueQuantityFingerprint(baklavaProfileAltCarton),
      );
    });
  });

  describe("display invariants", () => {
    it("never formats normalized output for unknown status", () => {
      expect(formatNormalizedQuantityLabel(48, "pcs", "unknown")).toBe("—");
      expect(formatNormalizedQuantityLabel(48, "pcs", "resolved")).toBe("48 pcs");
    });
  });
});
