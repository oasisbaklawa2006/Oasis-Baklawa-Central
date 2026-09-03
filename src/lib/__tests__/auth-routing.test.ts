import { describe, it, expect } from "vitest";
import {
  getRoleDestination,
  isPathWithinRoleDestination,
  isStaffRole,
  isStorefrontRole,
  normalizePathname,
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
    expect(getRoleDestination("HOD_CHOCOLATE")).toBe("/operations-controller");
    expect(getRoleDestination("B2B_BUYER")).toBe("/buyer");
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
    expect(getRoleDestination("HOD_DATES")).toBe("/operations-controller");
    expect(isStaffRole("PROD_DATES")).toBe(true);
    expect(isStaffRole("HOD_DATES")).toBe(true);
  });

  it("routes the Ready Goods TV account to the kiosk route, not /admin", () => {
    expect(getRoleDestination("TV_READY")).toBe("/tv/rgs");
  });

  it("routes the 3PGS TV kiosk account to the chrome-free wall, not /admin", () => {
    expect(getRoleDestination("TV_3PGS")).toBe("/tv/3pgs");
  });

  // Regression guard: these roles were previously landed on /admin/production
  // (a desktop-tabbed admin console with no handheld components) despite
  // needing the mobile-first, department-scoped OperationsController --
  // confirmed by a reachability audit. HOD_ASSEMBLY is deliberately excluded:
  // it keeps its own dedicated P&A management screen, not the production
  // floor handheld surface.
  it("lands production-floor HODs and the production manager on the handheld OperationsController, not the desktop admin console", () => {
    expect(getRoleDestination("PRODUCTION_MANAGER")).toBe("/operations-controller");
    expect(getRoleDestination("HOD_ARABIC")).toBe("/operations-controller");
    expect(getRoleDestination("HOD_FUSION")).toBe("/operations-controller");
    expect(getRoleDestination("HOD_CHOCOLATE")).toBe("/operations-controller");
    expect(getRoleDestination("HOD_DRAGEES")).toBe("/operations-controller");
    expect(getRoleDestination("HOD_DATES")).toBe("/operations-controller");
    expect(getRoleDestination("HOD_BAKERY")).toBe("/operations-controller");
    expect(getRoleDestination("HOD_NUTS")).toBe("/operations-controller");
    expect(getRoleDestination("HOD_ASSEMBLY")).toBe("/admin/assembly-tasks");
  });

  it("respects nested paths within a role's destination", () => {
    expect(isPathWithinRoleDestination("/admin/cmd-war-room", "ADMIN")).toBe(true);
    expect(isPathWithinRoleDestination("/admin/cmd-war-room/foo", "ADMIN")).toBe(true);
    expect(isPathWithinRoleDestination("/sales/dashboard", "SALES_EXECUTIVE")).toBe(true);
    expect(isPathWithinRoleDestination("/admin/users", "B2B_BUYER")).toBe(false);
  });

  it("strips any number of repeated trailing slashes, not just one", () => {
    expect(normalizePathname("/admin/3pgs-procurement-queue")).toBe("/admin/3pgs-procurement-queue");
    expect(normalizePathname("/admin/3pgs-procurement-queue/")).toBe("/admin/3pgs-procurement-queue");
    expect(normalizePathname("/admin/3pgs-procurement-queue//")).toBe("/admin/3pgs-procurement-queue");
    expect(normalizePathname("/admin/3pgs-procurement-queue///")).toBe("/admin/3pgs-procurement-queue");
    expect(normalizePathname("/")).toBe("/");
    expect(normalizePathname("//")).toBe("/");
    expect(normalizePathname("")).toBe("/");
  });
});
