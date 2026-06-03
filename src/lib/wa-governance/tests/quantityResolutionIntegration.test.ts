import { describe, expect, it } from "vitest";
import { resolveQuantityCandidates } from "@/lib/wa-governance/fetchQuantityResolution";
import {
  buildQuantityResolutionFetchInput,
  buildQuantityResolutionRequestDescriptor,
  buildQuantityResolutionRequestKey,
} from "@/lib/wa-governance/quantityResolutionRequestKey";
import {
  getCachedQuantityResolutionState,
  storeCachedQuantityResolutionResult,
} from "@/lib/wa-governance/quantityResolutionResultCache";
import type { OperatorInboxProductResolutionState } from "@/lib/wa-governance/productResolutionRequestKey";
import type { OperatorInboxClientResolutionState } from "@/lib/wa-governance/clientResolutionRequestKey";

const baklavaProfile = {
  category: "Baklava",
  uom: "Pc",
  weight_per_box_kg: 6,
  grams_per_piece: 22,
  pcs_per_master_carton: 24,
};

const mamoulProfile = {
  category: "Mamoul",
  uom: "Pc",
  weight_per_box_kg: 5,
  grams_per_piece: 30,
  pcs_per_master_carton: 18,
};

const readyIdentity = {
  status: "ready" as const,
  kind: "customer" as const,
  companyName: "HDFC Bank",
  customerName: "Alice",
};

const readyClient = (): OperatorInboxClientResolutionState => ({
  status: "ready",
  requestKey: "client-key",
  result: {
    candidateClients: [],
    bestMatch: {
      companyId: "c-1",
      companyName: "HDFC Bank",
      ownerId: null,
      ownerName: null,
      confidence: 96,
      reasons: [],
    },
    band: "auto_highlight",
  },
});

const readyProduct = (
  productId: string,
  productName: string,
): OperatorInboxProductResolutionState => ({
  status: "ready",
  requestKey: "product-key",
  result: {
    candidateProducts: [],
    bestMatch: {
      productId,
      productName,
      sku: "SKU-1",
      confidence: 96,
      reasons: [],
    },
    band: "auto_highlight",
  },
});

const packet = (content: string) => ({
  id: "packet-1",
  phone_number: "+919876543210",
  wa_contact_id: "wa-1",
  customer_name: "Alice",
  stitched_content: { plain: content },
  messages: [
    {
      id: "m-1",
      direction: "inbound" as const,
      content,
      created_at: "2026-06-01T10:00:00Z",
    },
  ],
});

function findLine(
  result: Awaited<ReturnType<typeof resolveQuantityCandidates>>,
  rawQuantity: number,
  rawUnit: string,
) {
  return result.quantities.find(
    (entry) => entry.rawQuantity === rawQuantity && entry.rawUnit === rawUnit,
  );
}

describe("quantityResolutionIntegration runtime path", () => {
  it("converts carton-equivalent units with product hint match through resolveQuantityCandidates", async () => {
    const input = {
      messageText: "2 cases baklava",
      stitchedPlainText: "",
      productBestMatchName: "Assorted Baklava 400gm Tin",
    };

    for (const messageText of ["2 cases baklava", "2 cartons baklava", "2 ctn baklava"]) {
      const result = await resolveQuantityCandidates(
        { ...input, messageText },
        null,
        baklavaProfile,
      );
      const line = result.quantities[0];
      expect(line).toMatchObject({
        rawQuantity: 2,
        conversionStatus: "resolved",
        normalizedQuantity: 48,
        normalizedUnit: "pcs",
        conversionSource: "products.pcs_per_master_carton",
      });
    }
  });

  it("does not apply carton inner-count conversion to pcs or box units", async () => {
    const pcsResult = await resolveQuantityCandidates(
      {
        messageText: "2 pcs baklava",
        stitchedPlainText: "",
        productBestMatchName: "Assorted Baklava 400gm Tin",
      },
      null,
      baklavaProfile,
    );
    expect(pcsResult.quantities[0]).toMatchObject({
      conversionStatus: "resolved",
      normalizedUnit: "kg",
      conversionSource: "products.grams_per_piece",
    });
    expect(pcsResult.quantities[0]?.conversionSource).not.toBe("products.pcs_per_master_carton");

    const boxResult = await resolveQuantityCandidates(
      {
        messageText: "2 box baklava",
        stitchedPlainText: "",
        productBestMatchName: "Assorted Baklava 400gm Tin",
      },
      null,
      baklavaProfile,
    );
    expect(boxResult.quantities[0]).toMatchObject({
      conversionStatus: "resolved",
      normalizedUnit: "kg",
      conversionSource: "products.weight_per_box_kg",
    });
    expect(boxResult.quantities[0]?.conversionSource).not.toBe("products.pcs_per_master_carton");
  });

  it("blocks catalogue conversion for mismatched single-line product hints", async () => {
    const result = await resolveQuantityCandidates(
      {
        messageText: "2 cases mamoul",
        stitchedPlainText: "",
        productBestMatchName: "Assorted Baklava 400gm Tin",
      },
      null,
      baklavaProfile,
    );

    expect(result.quantities[0]).toMatchObject({
      rawQuantity: 2,
      rawUnit: "cases",
      productHint: "Mamoul",
      conversionStatus: "unknown",
    });
    expect(result.quantities[0]?.normalizedQuantity).toBeUndefined();
    expect(result.quantities[0]?.conversionSource).toBeUndefined();
  });

  it("does not leak carton conversion between multi-line entries", async () => {
    const cartonFirst = await resolveQuantityCandidates(
      {
        messageText: "2 Baklava cartons and 50 Baklava pcs",
        stitchedPlainText: "",
        productBestMatchName: "Assorted Baklava 400gm Tin",
      },
      null,
      baklavaProfile,
    );
    const cartonLine = findLine(cartonFirst, 2, "cartons");
    const pcsLine = findLine(cartonFirst, 50, "pcs");
    expect(cartonLine?.conversionSource).toBe("products.pcs_per_master_carton");
    expect(pcsLine?.conversionSource).toBe("products.grams_per_piece");
    expect(pcsLine?.conversionSource).not.toBe("products.pcs_per_master_carton");

    const pcsFirst = await resolveQuantityCandidates(
      {
        messageText: "50 Baklava pcs and 2 Baklava cartons",
        stitchedPlainText: "",
        productBestMatchName: "Assorted Baklava 400gm Tin",
      },
      null,
      baklavaProfile,
    );
    expect(findLine(pcsFirst, 50, "pcs")?.conversionSource).toBe("products.grams_per_piece");
    expect(findLine(pcsFirst, 2, "cartons")?.conversionSource).toBe(
      "products.pcs_per_master_carton",
    );
  });

  it("blocks non-matching multi-line hints while converting matching carton lines only", async () => {
    const result = await resolveQuantityCandidates(
      {
        messageText: "2 Baklava cartons and 50 Mamoul pcs",
        stitchedPlainText: "",
        productBestMatchName: "Assorted Baklava 400gm Tin",
      },
      null,
      baklavaProfile,
    );

    expect(findLine(result, 2, "cartons")).toMatchObject({
      conversionStatus: "resolved",
      conversionSource: "products.pcs_per_master_carton",
    });
    expect(findLine(result, 50, "pcs")).toMatchObject({
      productHint: "Mamoul",
      conversionStatus: "unknown",
    });
    expect(findLine(result, 50, "pcs")?.normalizedQuantity).toBeUndefined();
  });

  it("uses buildQuantityResolutionFetchInput on the same path as the inbox hook", async () => {
    const content = "2 cartons baklava";
    const fetchInput = buildQuantityResolutionFetchInput(
      packet(content),
      content,
      readyProduct("p-baklava", "Assorted Baklava 400gm Tin"),
    );

    const result = await resolveQuantityCandidates(fetchInput, null, baklavaProfile);
    expect(result.quantities[0]).toMatchObject({
      rawQuantity: 2,
      rawUnit: "cartons",
      conversionStatus: "resolved",
      normalizedQuantity: 48,
      normalizedUnit: "pcs",
    });
  });

  it("does not reuse cached results across different product best matches or units", async () => {
    const cache = new Map();
    const contentA = "2 cartons baklava";
    const contentB = "2 pcs baklava";

    const descriptorA = buildQuantityResolutionRequestDescriptor(
      packet(contentA),
      readyIdentity,
      contentA,
      readyClient(),
      readyProduct("p-baklava", "Assorted Baklava 400gm Tin"),
    )!;
    const descriptorB = buildQuantityResolutionRequestDescriptor(
      packet(contentB),
      readyIdentity,
      contentB,
      readyClient(),
      readyProduct("p-mamoul", "Assorted Mamoul 400gm Tin"),
    )!;
    const keyA = buildQuantityResolutionRequestKey(descriptorA);
    const keyB = buildQuantityResolutionRequestKey(descriptorB);
    expect(keyA).not.toBe(keyB);

    const resultA = await resolveQuantityCandidates(
      {
        messageText: contentA,
        stitchedPlainText: contentA,
        productBestMatchName: "Assorted Baklava 400gm Tin",
      },
      null,
      baklavaProfile,
    );
    storeCachedQuantityResolutionResult(cache, keyA, resultA);

    const resultB = await resolveQuantityCandidates(
      {
        messageText: contentB,
        stitchedPlainText: contentB,
        productBestMatchName: "Assorted Mamoul 400gm Tin",
      },
      null,
      mamoulProfile,
    );
    storeCachedQuantityResolutionResult(cache, keyB, resultB);

    expect(getCachedQuantityResolutionState(keyA, cache)?.result.quantities[0]?.conversionSource).toBe(
      "products.pcs_per_master_carton",
    );
    expect(getCachedQuantityResolutionState(keyB, cache)?.result.quantities[0]?.conversionSource).toBe(
      "products.grams_per_piece",
    );
    expect(getCachedQuantityResolutionState(keyB, cache)?.result).not.toEqual(
      getCachedQuantityResolutionState(keyA, cache)?.result,
    );
  });
});
