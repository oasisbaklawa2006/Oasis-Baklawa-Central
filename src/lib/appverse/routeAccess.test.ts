import { describe, expect, it } from "vitest";
import {
  canAccessGoldenChainOperatorRoute,
  getRequiredModuleForAdminPath,
  isAuthorizedForAdminPath,
} from "./routeAccess";

describe("getRequiredModuleForAdminPath", () => {
  it("returns null for non-admin paths", () => {
    expect(getRequiredModuleForAdminPath("/dashboard")).toBeNull();
  });

  it("falls back to the dashboard module for an unmapped admin path", () => {
    expect(getRequiredModuleForAdminPath("/admin/some-unmapped-page")).toBe("dashboard");
  });

  it("maps the 3PGS packing-material catalogue to the inventory module, not the dashboard fallback", () => {
    expect(getRequiredModuleForAdminPath("/admin/3pgs-packing-material")).toBe("inventory");
    expect(getRequiredModuleForAdminPath("/admin/3pgs-packing-material/anything")).toBe("inventory");
  });

  it("prefers the longer, more specific prefix over a shorter overlapping one", () => {
    expect(getRequiredModuleForAdminPath("/admin/ready-goods")).toBe("inventory");
    expect(getRequiredModuleForAdminPath("/admin/inventory-risk-board")).toBe("inventory");
  });

  it("maps the read-only Dispatch TV surface to the dispatch module, not the dashboard fallback", () => {
    expect(getRequiredModuleForAdminPath("/admin/dispatch-tv")).toBe("dispatch");
    expect(getRequiredModuleForAdminPath("/admin/dispatch-tv/anything")).toBe("dispatch");
  });
});

describe("golden chain operator route access", () => {
  it("allows finance and inventory pilot roles even though the route maps to dispatch", () => {
    expect(canAccessGoldenChainOperatorRoute("FINANCE_HEAD")).toBe(true);
    expect(canAccessGoldenChainOperatorRoute("FINANCE_EXEC")).toBe(true);
    expect(canAccessGoldenChainOperatorRoute("STORE_READY_GOODS")).toBe(true);
    expect(canAccessGoldenChainOperatorRoute("DISPATCH_MANAGER")).toBe(true);
  });

  it("authorizes golden-chain-operator through the dispatch/finance/inventory union", () => {
    expect(isAuthorizedForAdminPath("/admin/golden-chain-operator", "FINANCE_HEAD")).toBe(true);
    expect(isAuthorizedForAdminPath("/admin/golden-chain-operator", "PROD_ARABIC_SWEETS")).toBe(false);
    expect(isAuthorizedForAdminPath("/admin/dispatch-readiness", "FINANCE_HEAD")).toBe(false);
  });
});
