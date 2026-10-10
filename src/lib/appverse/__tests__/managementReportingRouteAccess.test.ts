import { describe, expect, it } from "vitest";
import { getRequiredModuleForAdminPath, isAuthorizedForAdminPath } from "../routeAccess";
import { getAllowedModulesForRole, hasModuleAccess } from "../roleAccess";

describe("management reporting route access", () => {
  it("maps management command center to management_reporting module", () => {
    expect(getRequiredModuleForAdminPath("/admin/management-command-center")).toBe(
      "management_reporting",
    );
  });

  it("grants FINANCE_HEAD and ADMIN access to management command center", () => {
    expect(isAuthorizedForAdminPath("/admin/management-command-center", "FINANCE_HEAD")).toBe(true);
    expect(isAuthorizedForAdminPath("/admin/management-command-center", "ADMIN")).toBe(true);
    expect(isAuthorizedForAdminPath("/admin/management-command-center", "OPERATIONS_MANAGER")).toBe(
      true,
    );
  });

  it("denies dispatch-only roles from management command center", () => {
    expect(isAuthorizedForAdminPath("/admin/management-command-center", "DISPATCH_MANAGER")).toBe(
      false,
    );
    expect(isAuthorizedForAdminPath("/admin/management-command-center", "PACKING_SUPERVISOR")).toBe(
      false,
    );
  });

  it("includes management_reporting in finance and admin role modules", () => {
    expect(hasModuleAccess(getAllowedModulesForRole("FINANCE_EXEC"), "management_reporting")).toBe(
      true,
    );
    expect(hasModuleAccess(getAllowedModulesForRole("SALES_EXECUTIVE"), "management_reporting")).toBe(
      false,
    );
  });
});
