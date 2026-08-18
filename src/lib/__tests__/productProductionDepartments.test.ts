import { describe, expect, it } from "vitest";
import {
  isAllowedProductProductionDepartment,
  normalizeProductProductionDepartment,
  productionDepartmentMatchesFilter,
  PRODUCT_PRODUCTION_DEPARTMENTS,
} from "@/lib/productProductionDepartments";

describe("productProductionDepartments", () => {
  it("exposes only live DB-allowed values", () => {
    expect(PRODUCT_PRODUCTION_DEPARTMENTS.map((department) => department.value)).toEqual([
      "arabic_sweets",
      "chocolates_confectionery",
      "bakery",
      "semi_prepared",
      "dragees",
      "fusion_sweets",
      "seasoned_nuts_mixes",
      "dates",
    ]);
  });

  it("normalizes legacy display labels to DB values", () => {
    expect(normalizeProductProductionDepartment("Arabic Sweets")).toBe("arabic_sweets");
    expect(normalizeProductProductionDepartment("Chocolates")).toBe("chocolates_confectionery");
    expect(normalizeProductProductionDepartment("Seasoned Nuts")).toBe("seasoned_nuts_mixes");
    expect(normalizeProductProductionDepartment("Dates")).toBe("dates");
    expect(normalizeProductProductionDepartment("Semi-Prepared")).toBe("semi_prepared");
  });

  it("rejects values removed from the live constraint", () => {
    expect(normalizeProductProductionDepartment("Packing & Assembly")).toBeNull();
    expect(normalizeProductProductionDepartment("3rd Party Store")).toBeNull();
    expect(isAllowedProductProductionDepartment("Arabic Sweets")).toBe(false);
  });

  describe("productionDepartmentMatchesFilter", () => {
    it("matches legacy display label filter to canonical product value", () => {
      expect(productionDepartmentMatchesFilter("Arabic Sweets", "arabic_sweets")).toBe(true);
    });

    it("matches canonical product value to legacy display label filter", () => {
      expect(productionDepartmentMatchesFilter("Arabic Sweets", "Arabic Sweets")).toBe(true);
    });

    it("matches chocolates_confectionery across label variants", () => {
      expect(productionDepartmentMatchesFilter("Chocolates", "chocolates_confectionery")).toBe(true);
      expect(productionDepartmentMatchesFilter("Chocolate", "chocolates_confectionery")).toBe(true);
    });

    it("does not match invalid or unrelated departments", () => {
      expect(productionDepartmentMatchesFilter("Arabic Sweets", "bakery")).toBe(false);
      expect(productionDepartmentMatchesFilter("Packing & Assembly", "arabic_sweets")).toBe(false);
      expect(productionDepartmentMatchesFilter("Arabic Sweets", "Packing & Assembly")).toBe(false);
      expect(productionDepartmentMatchesFilter("", "arabic_sweets")).toBe(false);
      expect(productionDepartmentMatchesFilter("Arabic Sweets", "")).toBe(false);
    });
  });
});
