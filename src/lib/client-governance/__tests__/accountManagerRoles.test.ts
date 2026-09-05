import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import {
  ACCOUNT_MANAGER_ELIGIBLE_ROLES,
  ACCOUNT_MANAGER_ROLE_DB_VALUES,
  buildAccountManagerUsersOrFilter,
  isAccountManagerEligibleUser,
} from "../accountManagerRoles";

describe("accountManagerRoles", () => {
  it("includes mixed-case production roles after normalization", () => {
    expect(isAccountManagerEligibleUser("SALES_EXECUTIVE")).toBe(true);
    expect(isAccountManagerEligibleUser("sales_executive")).toBe(true);
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

  it("exposes canonical eligible roles and legacy DB values for PostgREST filters", () => {
    expect(ACCOUNT_MANAGER_ELIGIBLE_ROLES.has("SALES_EXECUTIVE")).toBe(true);
    expect(ACCOUNT_MANAGER_ROLE_DB_VALUES).toEqual(
      expect.arrayContaining(["SALES_EXECUTIVE", "sales_executive", "ADMIN", "admin", "SUPER_ADMIN", "super_admin"]),
    );
  });

  it("builds an OR filter that includes uppercase and lowercase role variants", () => {
    const filter = buildAccountManagerUsersOrFilter();
    expect(filter).toContain("role.eq.SALES_EXECUTIVE");
    expect(filter).toContain("role.eq.sales_executive");
    expect(filter).toContain("role.eq.ADMIN");
    expect(filter).toContain("role.eq.admin");
    expect(filter).toContain("role.eq.SUPER_ADMIN");
    expect(filter).toContain("role.eq.super_admin");
    expect(filter).toContain("is_sales_executive.eq.true");
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
