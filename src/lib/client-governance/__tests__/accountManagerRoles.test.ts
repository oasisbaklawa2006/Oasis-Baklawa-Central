import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import {
  ACCOUNT_MANAGER_CANONICAL_ROLES,
  ACCOUNT_MANAGER_ELIGIBLE_ROLES,
  buildAccountManagerUsersOrFilter,
  isAccountManagerEligibleUser,
} from "../accountManagerRoles";

describe("accountManagerRoles", () => {
  it("includes mixed-case production roles after normalization", () => {
    expect(isAccountManagerEligibleUser("SALES_EXECUTIVE")).toBe(true);
    expect(isAccountManagerEligibleUser("sales_executive")).toBe(true);
    expect(isAccountManagerEligibleUser("Sales_Executive")).toBe(true);
    expect(isAccountManagerEligibleUser("ADMIN")).toBe(true);
    expect(isAccountManagerEligibleUser("admin")).toBe(true);
    expect(isAccountManagerEligibleUser("SUPER_ADMIN")).toBe(true);
    expect(isAccountManagerEligibleUser(" super_admin ")).toBe(true);
  });

  it("honours is_sales_executive regardless of role casing", () => {
    expect(isAccountManagerEligibleUser("FINANCE_HEAD", true)).toBe(true);
    expect(isAccountManagerEligibleUser("SALES_EXECUTIVE", true)).toBe(true);
  });

  it("rejects ineligible roles while keeping is_active filtering separate", () => {
    expect(isAccountManagerEligibleUser("FINANCE_HEAD")).toBe(false);
    expect(isAccountManagerEligibleUser("CUSTOMER_USER")).toBe(false);
    expect(isAccountManagerEligibleUser(null)).toBe(false);
  });

  it("exposes canonical eligible roles for PostgREST ilike filters", () => {
    expect(ACCOUNT_MANAGER_ELIGIBLE_ROLES.has("SALES_EXECUTIVE")).toBe(true);
    expect(ACCOUNT_MANAGER_CANONICAL_ROLES).toEqual(["SALES_EXECUTIVE", "ADMIN", "SUPER_ADMIN"]);
  });

  it("builds a case-insensitive OR filter so mixed-case production roles are not excluded", () => {
    const filter = buildAccountManagerUsersOrFilter();
    expect(filter).toContain("role.ilike.SALES_EXECUTIVE");
    expect(filter).toContain("role.ilike.ADMIN");
    expect(filter).toContain("role.ilike.SUPER_ADMIN");
    expect(filter).toContain("is_sales_executive.eq.true");
    expect(filter).not.toContain("role.eq.");
  });
});

describe("AdminClients manager query contract", () => {
  it("uses normalized account-manager role helpers instead of lowercase-only filters", () => {
    const source = readFileSync(resolve(process.cwd(), "src/pages/admin/AdminClients.tsx"), "utf8");
    expect(source).toContain("buildAccountManagerUsersOrFilter()");
    expect(source).toContain("isAccountManagerEligibleUser(");
    expect(source).not.toContain('role.eq.sales_executive,role.eq.admin,role.eq.super_admin');
  });
});
