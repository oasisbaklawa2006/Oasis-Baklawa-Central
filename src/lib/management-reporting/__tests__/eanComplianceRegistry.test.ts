import { describe, expect, it } from "vitest";
import {
  buildComplianceExceptions,
  buildEanDuplicateIndex,
  buildEanRegistryEntries,
  normalizeEan,
  type ProductComplianceRow,
} from "../eanComplianceRegistry";

function product(partial: Partial<ProductComplianceRow> & Pick<ProductComplianceRow, "id" | "name">): ProductComplianceRow {
  return {
    sku: "SKU-1",
    barcode_sku: "8901234567890",
    hsn_code: "1905",
    gst_percentage: 5,
    allergen_warnings: "Tree nuts",
    ingredients: "Flour, nuts",
    nutrition_facts: { calories: 100 },
    is_active: true,
    ...partial,
  };
}

describe("eanComplianceRegistry", () => {
  it("normalizes EAN digits", () => {
    expect(normalizeEan("890-1234-567890")).toBe("8901234567890");
    expect(normalizeEan("123")).toBeNull();
  });

  it("detects duplicate EAN assignments", () => {
    const products = [
      product({ id: "p1", name: "A", barcode_sku: "8901234567890" }),
      product({ id: "p2", name: "B", barcode_sku: "8901234567890" }),
    ];
    const index = buildEanDuplicateIndex(products);
    expect(index.get("8901234567890")).toEqual(["p1", "p2"]);
    const { entries } = buildEanRegistryEntries(products);
    expect(entries.filter((e) => e.isDuplicate)).toHaveLength(2);
  });

  it("builds compliance exceptions for missing EAN and company FSSAI", () => {
    const exceptions = buildComplianceExceptions({
      products: [product({ id: "p1", name: "A", barcode_sku: null })],
      companies: [{ id: "c1", business_name: "Client", fssai_number: null, gst_number: null }],
    });
    expect(exceptions.some((e) => e.category === "ean" && e.severity === "critical")).toBe(true);
    expect(exceptions.some((e) => e.category === "fssai")).toBe(true);
  });
});
