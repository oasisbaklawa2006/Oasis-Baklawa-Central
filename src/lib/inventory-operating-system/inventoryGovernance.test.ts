import { describe, expect, it } from "vitest";
import { canRolePerform, rolesAllowedForInventoryAction } from "./inventoryGovernance";

describe("inventoryGovernance", () => {
  it("returns stable role lists per action", () => {
    expect(rolesAllowedForInventoryAction("void_movement")).toEqual(["cmd", "super_admin"]);
    expect(rolesAllowedForInventoryAction("apply_reservation_hold")).toContain("inventory_controller");
  });

  it("denies unauthorized roles", () => {
    expect(canRolePerform("store_operator", "void_movement")).toBe(false);
    expect(canRolePerform("cmd", "void_movement")).toBe(true);
  });
});
