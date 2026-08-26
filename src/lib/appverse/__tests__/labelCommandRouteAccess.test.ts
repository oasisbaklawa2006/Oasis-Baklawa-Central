import { describe, expect, it } from "vitest";
import { getRequiredModuleForAdminPath } from "../routeAccess";
import { getAllowedModulesForRole, hasModuleAccess } from "../roleAccess";

describe("Label Command Center role reachability", () => {
  it("uses packing authority so PACKING_SUPERVISOR can reach the label surface without orders access", () => {
    const requiredModule = getRequiredModuleForAdminPath("/admin/label-command-center");
    const packingSupervisorModules = getAllowedModulesForRole("PACKING_SUPERVISOR");

    expect(requiredModule).toBe("packing");
    expect(hasModuleAccess(packingSupervisorModules, requiredModule!)).toBe(true);
    expect(packingSupervisorModules).not.toContain("orders");
  });
});
