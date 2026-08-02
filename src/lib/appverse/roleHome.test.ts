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

  it("does not surface cards outside the caller module set", () => {
    const cards = getVisibleRoleHomeCards("OPERATIONS_MANAGER", ["dashboard", "production"]);
    expect(cards.every((card) => ["dashboard", "production"].includes(card.moduleKey))).toBe(true);
  });

  it("allows super access to the complete executive Home set", () => {
    const cards = getVisibleRoleHomeCards("SUPER_ADMIN", ["*"]);
    expect(cards.length).toBeGreaterThanOrEqual(6);
  });

  it("keeps security control limited to the gate surface", () => {
    const cards = getVisibleRoleHomeCards("SECURITY_CONTROL", ["dashboard", "packing"]);
    expect(cards).toHaveLength(1);
    expect(cards[0]?.route).toBe("/security-gate");
  });
});
