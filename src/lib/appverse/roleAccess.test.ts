import { describe, expect, it } from "vitest";
import { getAllowedModulesForRole, hasModuleAccess, normalizeAppverseRole } from "./roleAccess";

describe("App-Verse role authority", () => {
  it("normalizes role identifiers", () => {
    expect(normalizeAppverseRole(" finance_head ")).toBe("FINANCE_HEAD");
  });

  it("keeps finance access finance-first", () => {
    const modules = getAllowedModulesForRole("FINANCE_HEAD");
    expect(modules).toContain("finance");
    expect(modules).toContain("accounts");
    expect(modules).not.toContain("production");
  });

  it("keeps gate security narrow", () => {
    expect(getAllowedModulesForRole("GATE_SECURITY")).toEqual(["dashboard", "packing"]);
  });

  it("keeps catalogue contributors out of operational authority", () => {
    const modules = getAllowedModulesForRole("CATALOGUE_CONTRIBUTOR");
    expect(modules).toEqual(["dashboard", "products"]);
  });

  it("supports wildcard authority without broadening normal roles", () => {
    expect(hasModuleAccess(["*"], "finance")).toBe(true);
    expect(hasModuleAccess(["production"], "finance")).toBe(false);
  });

  it("keeps Dispatch roles out of the general orders module (shipment-scoped visibility only)", () => {
    for (const role of ["DISPATCH_MANAGER", "DISPATCH_INCHARGE", "DISPATCH_HEAD"]) {
      const modules = getAllowedModulesForRole(role);
      expect(modules).not.toContain("orders");
      expect(modules).not.toContain("cmd_war_room");
      expect(modules).not.toContain("inventory");
    }
    expect(getAllowedModulesForRole("DISPATCH_MANAGER")).toContain("dispatch");
    expect(getAllowedModulesForRole("DISPATCH_INCHARGE")).toContain("packing");
  });
});
