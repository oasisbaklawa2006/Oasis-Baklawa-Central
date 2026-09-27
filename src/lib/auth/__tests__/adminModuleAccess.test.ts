import { describe, expect, it } from "vitest";
import {
  hasAdminModuleAccess,
  ROLE_MODULE_ACCESS,
} from "../adminModuleAccess";
import {
  hasModuleAccess,
  ROLE_MODULE_ACCESS as CANONICAL_ROLE_MODULE_ACCESS,
} from "@/lib/appverse/roleAccess";

describe("adminModuleAccess (legacy re-export)", () => {
  it("re-exports the canonical roleAccess ROLE_MODULE_ACCESS map", () => {
    expect(ROLE_MODULE_ACCESS).toBe(CANONICAL_ROLE_MODULE_ACCESS);
  });

  it("delegates hasAdminModuleAccess to hasModuleAccess", () => {
    const modules = ROLE_MODULE_ACCESS.ADMIN;
    expect(hasAdminModuleAccess("ADMIN", "dashboard")).toBe(
      hasModuleAccess(modules, "dashboard"),
    );
    expect(hasAdminModuleAccess("ADMIN", "dispatch")).toBe(
      hasModuleAccess(modules, "dispatch"),
    );
    expect(hasAdminModuleAccess("ADMIN", "not_a_configured_module")).toBe(false);
  });

  it("allows all modules for super admin via wildcard convention", () => {
    expect(hasAdminModuleAccess("SUPER_ADMIN", "cmd_war_room")).toBe(true);
    expect(hasAdminModuleAccess("SUPER_ADMIN", "not_a_configured_module")).toBe(true);
  });

  it("denies cmd_war_room for dispatch roles", () => {
    for (const role of ["DISPATCH_MANAGER", "DISPATCH_INCHARGE", "DISPATCH_HEAD"]) {
      expect(hasAdminModuleAccess(role, "cmd_war_room")).toBe(false);
    }
  });
});
