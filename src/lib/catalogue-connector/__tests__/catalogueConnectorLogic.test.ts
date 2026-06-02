import { describe, expect, it } from "vitest";
import { isStaleCatalogueVersion, normalizeCatalogueSku } from "../catalogueConnectorLogic";

describe("catalogueConnectorLogic", () => {
  it("normalizeCatalogueSku uppercases and trims", () => {
    expect(normalizeCatalogueSku("  oas-pur-1 ")).toBe("OAS-PUR-1");
  });

  it("isStaleCatalogueVersion when incoming is older", () => {
    expect(isStaleCatalogueVersion(1, 2)).toBe(true);
    expect(isStaleCatalogueVersion(2, 2)).toBe(false);
    expect(isStaleCatalogueVersion(3, 2)).toBe(false);
  });
});
