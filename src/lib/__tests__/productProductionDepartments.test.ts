import { describe, expect, it } from "vitest";
import {
  isAllowedProductProductionDepartment,
  normalizeProductProductionDepartment,
  PRODUCT_PRODUCTION_DEPARTMENTS,
} from "@/lib/productProductionDepartments";

describe("productProductionDepartments", () => {
  it("exposes only live DB-allowed values", () => {
    expect(PRODUCT_PRODUCTION_DEPARTMENTS.map((department) => department.value)).toEqual([
      "arabic_sweets",
      "chocolates_confectionery",
      "bakery",
      "dragees",
      "fusion_sweets",
      "seasoned_nuts_mixes",
    ]);
  });

  it("normalizes legacy display labels to DB values", () => {
    expect(normalizeProductProductionDepartment("Arabic Sweets")).toBe("arabic_sweets");
    expect(normalizeProductProductionDepartment("Chocolates")).toBe("chocolates_confectionery");
    expect(normalizeProductProductionDepartment("Seasoned Nuts")).toBe("seasoned_nuts_mixes");
  });

  it("rejects values removed from the live constraint", () => {
    expect(normalizeProductProductionDepartment("Packing & Assembly")).toBeNull();
    expect(normalizeProductProductionDepartment("3rd Party Store")).toBeNull();
    expect(isAllowedProductProductionDepartment("Arabic Sweets")).toBe(false);
  });
});
