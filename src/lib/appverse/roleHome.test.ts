import { describe, expect, it } from "vitest";
import { getRoleHomeDefinition, getVisibleRoleHomeCards } from "./roleHome";

describe("App-Verse role-aware Home model", () => {
  it("gives finance roles finance-first work", () => {
    const home = getRoleHomeDefinition("FINANCE_HEAD");
    expect(home.title).toBe("Finance today");
    expect(home.cards[0]?.moduleKey).toBe("finance");
  });

  it("keeps production roles narrowly focused", () => {
    const cards = getVisibleRoleHomeCards("HOD_BAKERY", ["dashboard", "production", "orders"]);
    expect(cards.map((card) => card.key)).toEqual(["production", "orders"]);
  });

  it("keeps shop-floor production roles out of executive home", () => {
    const home = getRoleHomeDefinition("PROD_CHOCOLATE");
    expect(home.title).toBe("Production today");
  });

  it("gives catalogue contributors catalogue-only work", () => {
    const cards = getVisibleRoleHomeCards("CATALOGUE_CONTRIBUTOR", ["dashboard", "products"]);
    expect(cards.map((card) => card.moduleKey)).toEqual(["products", "products", "products"]);
  });

  it("does not surface cards outside the caller module set", () => {
    const cards = getVisibleRoleHomeCards("OPERATIONS_MANAGER", ["dashboard", "production"]);
    expect(cards.every((card) => ["dashboard", "production"].includes(card.moduleKey))).toBe(true);
  });

  it("allows super access to the complete executive Home set", () => {
    const cards = getVisibleRoleHomeCards("SUPER_ADMIN", ["*"]);
    expect(cards.length).toBeGreaterThanOrEqual(6);
  });

  it("keeps security and gate roles limited to the gate surface", () => {
    for (const role of ["SECURITY_CONTROL", "GATE_SECURITY"]) {
      const cards = getVisibleRoleHomeCards(role, ["dashboard", "packing"]);
      expect(cards).toHaveLength(1);
      expect(cards[0]?.route).toBe("/security-gate");
    }
  });

  it("keeps dedicated TV roles action-free", () => {
    expect(getRoleHomeDefinition("TV_DISPLAY").cards).toEqual([]);
  });
});
