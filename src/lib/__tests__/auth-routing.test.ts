import { describe, it, expect } from "vitest";
import {
  getRoleDestination,
  isPathWithinRoleDestination,
  isStaffRole,
  isStorefrontRole,
  normalizeRole,
} from "@/lib/auth-routing";

describe("auth-routing", () => {
  it("normalizes any casing/whitespace to upper-case role", () => {
    expect(normalizeRole(" admin ")).toBe("ADMIN");
    expect(normalizeRole(undefined)).toBeNull();
    expect(normalizeRole(null)).toBeNull();
  });

  it("classifies staff roles", () => {
    expect(isStaffRole("ADMIN")).toBe(true);
    expect(isStaffRole("HOD_ARABIC")).toBe(true);
    expect(isStaffRole("B2B_BUYER")).toBe(false);
    expect(isStaffRole(null)).toBe(false);
  });

  it("classifies buyer / storefront roles", () => {
    expect(isStorefrontRole("B2B_BUYER")).toBe(true);
    expect(isStorefrontRole("BULK_BUYER")).toBe(true);
    expect(isStorefrontRole("ADMIN")).toBe(false);
  });

  it("returns deterministic destinations per role", () => {
    expect(getRoleDestination("SUPER_ADMIN")).toBe("/admin/cmd-war-room");
    expect(getRoleDestination("ADMIN")).toBe("/admin/cmd-war-room");
    expect(getRoleDestination("FINANCE_HEAD")).toBe("/admin/accounts-release");
    expect(getRoleDestination("HOD_CHOCOLATE")).toBe("/admin/production");
    expect(getRoleDestination("B2B_BUYER")).toBe("/customer-app-redirect");
    expect(getRoleDestination(null)).toBe("/customer-app-redirect");
    expect(getRoleDestination("PENDING")).toBe("/customer-app-redirect");
    expect(getRoleDestination("UNKNOWN_ROLE")).toBe("/customer-app-redirect");
  });

  it("respects nested paths within a role's destination", () => {
    expect(isPathWithinRoleDestination("/admin/cmd-war-room", "ADMIN")).toBe(true);
    expect(isPathWithinRoleDestination("/admin/cmd-war-room/foo", "ADMIN")).toBe(true);
    expect(isPathWithinRoleDestination("/sales/dashboard", "SALES_EXECUTIVE")).toBe(true);
    expect(isPathWithinRoleDestination("/admin/users", "B2B_BUYER")).toBe(false);
  });
});
