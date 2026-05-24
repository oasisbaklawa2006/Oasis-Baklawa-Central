import { describe, expect, it } from "vitest";
import { hasAdminModuleAccess, ROLE_MODULE_ACCESS } from "../adminModuleAccess";

/** Mirrors AdminLayout.tsx ADMIN module list — live-work-queues / entity-graph use cmd_war_room. */
const ADMIN_LAYOUT_MODULES = [
  "dashboard",
  "cmd_war_room",
  "orders",
  "clients",
  "products",
  "pricing",
  "finance",
  "users",
  "moq",
  "currency",
  "support",
  "settings",
  "audit",
  "inventory",
  "packing",
  "production",
  "accounts",
  "exceptions",
] as const;

/** Routes guarded by AdminModuleRoute moduleKey="cmd_war_room" in App.tsx. */
const CMD_WAR_ROOM_ROUTE_MODULE = "cmd_war_room";

describe("adminModuleAccess", () => {
  describe("ADMIN aligns with AdminLayout (no wildcard)", () => {
    it("matches explicit AdminLayout module list", () => {
      expect(ROLE_MODULE_ACCESS.ADMIN).toEqual([...ADMIN_LAYOUT_MODULES]);
      expect(ROLE_MODULE_ACCESS.ADMIN).not.toContain("*");
    });

    it("allows each explicit admin module", () => {
      for (const moduleKey of ADMIN_LAYOUT_MODULES) {
        expect(hasAdminModuleAccess("ADMIN", moduleKey)).toBe(true);
      }
    });

    it("denies arbitrary unknown module keys", () => {
      expect(hasAdminModuleAccess("ADMIN", "not_a_configured_module")).toBe(false);
      expect(hasAdminModuleAccess("ADMIN", "super_secret_ops")).toBe(false);
    });
  });

  describe("cmd_war_room (live-work-queues, entity-graph-explorer)", () => {
    it("allows cmd_war_room for roles with war-room access", () => {
      for (const role of [
        "OPERATIONS_MANAGER",
        "DISPATCH_MANAGER",
        "FINANCE_HEAD",
        "ADMIN",
        "SUPER_ADMIN",
      ]) {
        expect(hasAdminModuleAccess(role, CMD_WAR_ROOM_ROUTE_MODULE)).toBe(true);
      }
    });

    it("denies cmd_war_room for production roles (cannot direct-open guarded routes)", () => {
      for (const role of ["PRODUCTION_MANAGER", "HOD_ARABIC", "ASSEMBLY_MANAGER"]) {
        expect(hasAdminModuleAccess(role, CMD_WAR_ROOM_ROUTE_MODULE)).toBe(false);
      }
    });
  });

  it("allows all modules for super admin via wildcard convention", () => {
    expect(hasAdminModuleAccess("SUPER_ADMIN", CMD_WAR_ROOM_ROUTE_MODULE)).toBe(true);
    expect(hasAdminModuleAccess("SUPER_ADMIN", "not_a_configured_module")).toBe(true);
  });
});
