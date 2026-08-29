import { describe, expect, it } from "vitest";
import {
  FACTORY_OPERATIONS_ROUTES,
  type FactoryRouteEntry,
} from "../factoryOperationsRouteRegistry";
import {
  isEffectivelyAuthorizedFactoryRole,
  resolveEffectiveFactoryCertificationRole,
} from "../factoryCertificationEffectiveAccess";

function route(path: string): FactoryRouteEntry {
  const entry = FACTORY_OPERATIONS_ROUTES.find((candidate) => candidate.route === path);
  if (!entry) throw new Error(`Missing Factory route fixture: ${path}`);
  return entry;
}

describe("Factory certification effective authorization", () => {
  it("does not confuse the broad /admin parent gate with AdminRouteGuard module authority", () => {
    expect(isEffectivelyAuthorizedFactoryRole(route("/admin/stock-finalization"), "DISPATCH_MANAGER")).toBe(false);
    expect(isEffectivelyAuthorizedFactoryRole(route("/admin/label-command-center"), "PACKING_SUPERVISOR")).toBe(false);
    expect(isEffectivelyAuthorizedFactoryRole(route("/admin/display-management"), "TV_DISPLAY")).toBe(false);
  });

  it("selects an actually authorized role instead of broadening runtime RBAC to satisfy certification", () => {
    expect(isEffectivelyAuthorizedFactoryRole(
      route("/admin/stock-finalization"),
      resolveEffectiveFactoryCertificationRole(route("/admin/stock-finalization")),
    )).toBe(true);
    expect(isEffectivelyAuthorizedFactoryRole(
      route("/admin/label-command-center"),
      resolveEffectiveFactoryCertificationRole(route("/admin/label-command-center")),
    )).toBe(true);
    expect(isEffectivelyAuthorizedFactoryRole(
      route("/admin/display-management"),
      resolveEffectiveFactoryCertificationRole(route("/admin/display-management")),
    )).toBe(true);
  });

  it("preserves intended-role selection where the role already passes the complete authorization chain", () => {
    expect(resolveEffectiveFactoryCertificationRole(route("/admin/production-demand-planner"))).toBe("PRODUCTION_MANAGER");
    expect(resolveEffectiveFactoryCertificationRole(route("/tv/arabic-sweets"))).toBe("PROD_ARABIC_SWEETS");
  });

  it("mirrors the R4 3PGS operator gate instead of certifying broad inventory roles", () => {
    const procurement = route("/admin/3pgs-procurement-queue");
    expect(isEffectivelyAuthorizedFactoryRole(procurement, "STORE_3RD_PARTY")).toBe(true);
    expect(isEffectivelyAuthorizedFactoryRole(procurement, "OPERATIONS_MANAGER")).toBe(true);
    expect(isEffectivelyAuthorizedFactoryRole(procurement, "DISPATCH_MANAGER")).toBe(false);
    expect(isEffectivelyAuthorizedFactoryRole(procurement, "STORE_READY_GOODS")).toBe(false);
    expect(resolveEffectiveFactoryCertificationRole(procurement)).toBe("STORE_3RD_PARTY");
  });
});
