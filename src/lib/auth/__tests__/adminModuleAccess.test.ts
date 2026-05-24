import { describe, expect, it } from "vitest";
import { hasAdminModuleAccess } from "../adminModuleAccess";

describe("adminModuleAccess", () => {
  it("allows cmd_war_room for operations manager", () => {
    expect(hasAdminModuleAccess("OPERATIONS_MANAGER", "cmd_war_room")).toBe(true);
  });

  it("denies cmd_war_room for production manager", () => {
    expect(hasAdminModuleAccess("PRODUCTION_MANAGER", "cmd_war_room")).toBe(false);
  });

  it("allows all modules for super admin", () => {
    expect(hasAdminModuleAccess("SUPER_ADMIN", "cmd_war_room")).toBe(true);
  });
});
