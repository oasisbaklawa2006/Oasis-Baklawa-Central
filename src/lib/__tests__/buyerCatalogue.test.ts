import { describe, expect, it } from "vitest";
import { isBuyerVisibleProduct } from "../buyerCatalogue";

describe("isBuyerVisibleProduct", () => {
  it("returns true only when is_active and visible_in_catalog are both true", () => {
    expect(
      isBuyerVisibleProduct({ is_active: true, visible_in_catalog: true }),
    ).toBe(true);
  });

  it("rejects inactive products", () => {
    expect(
      isBuyerVisibleProduct({ is_active: false, visible_in_catalog: true }),
    ).toBe(false);
  });

  it("rejects hidden-from-catalog products", () => {
    expect(
      isBuyerVisibleProduct({ is_active: true, visible_in_catalog: false }),
    ).toBe(false);
  });

  it("rejects null or undefined flag values", () => {
    expect(
      isBuyerVisibleProduct({ is_active: null, visible_in_catalog: true }),
    ).toBe(false);
    expect(
      isBuyerVisibleProduct({ is_active: true, visible_in_catalog: null as unknown as boolean }),
    ).toBe(false);
  });
});
