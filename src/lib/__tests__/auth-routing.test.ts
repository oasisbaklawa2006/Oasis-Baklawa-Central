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

  // Owner's six-TV estate (Central issue #368): Dragees has no standalone
  // TV, and Ready Goods runs on its own chrome-free kiosk route rather than
  // the full authenticated /admin shell.
  it("folds Dragees floor roles into the Chocolate Line TV", () => {
    expect(getRoleDestination("PROD_DRAGEES")).toBe("/tv/chocolate");
  });

  it("folds Dates floor/HOD roles into the Fusion Sweets surfaces", () => {
    expect(getRoleDestination("PROD_DATES")).toBe("/tv/fusion");
    expect(getRoleDestination("HOD_DATES")).toBe("/admin/production");
    expect(isStaffRole("PROD_DATES")).toBe(true);
    expect(isStaffRole("HOD_DATES")).toBe(true);
  });

  it("routes the Ready Goods TV account to the kiosk route, not /admin", () => {
    expect(getRoleDestination("TV_READY")).toBe("/tv/rgs");
  });

  it("respects nested paths within a role's destination", () => {
    expect(isPathWithinRoleDestination("/admin/cmd-war-room", "ADMIN")).toBe(true);
    expect(isPathWithinRoleDestination("/admin/cmd-war-room/foo", "ADMIN")).toBe(true);
    expect(isPathWithinRoleDestination("/sales/dashboard", "SALES_EXECUTIVE")).toBe(true);
    expect(isPathWithinRoleDestination("/admin/users", "B2B_BUYER")).toBe(false);
  });
});
