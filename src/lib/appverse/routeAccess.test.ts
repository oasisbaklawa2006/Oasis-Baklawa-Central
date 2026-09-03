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

  it("maps the read-only Dispatch TV surface to orders (commercial), not the dispatch workflow module", () => {
    expect(getRequiredModuleForAdminPath("/admin/dispatch-tv")).toBe("orders");
    expect(getRequiredModuleForAdminPath("/admin/dispatch-tv/anything")).toBe("orders");
  });

  it("maps Executive Dashboard (heartbeat) to cmd_war_room, not the App-Verse home dashboard", () => {
    expect(getRequiredModuleForAdminPath("/admin/heartbeat")).toBe("cmd_war_room");
    expect(getRequiredModuleForAdminPath("/admin")).toBe("dashboard");
  });

  it("maps legacy commercial packing/dispatch screens to orders, not dispatch workflow modules", () => {
    expect(getRequiredModuleForAdminPath("/admin/packing-dispatch")).toBe("orders");
    expect(getRequiredModuleForAdminPath("/admin/dispatch")).toBe("orders");
    expect(getRequiredModuleForAdminPath("/admin/dispatch-mgmt")).toBe("packing");
    expect(getRequiredModuleForAdminPath("/admin/dispatch-tv")).toBe("orders");
  });

  it("maps hyphenated admin routes to their owning modules instead of dashboard fallback", () => {
    expect(getRequiredModuleForAdminPath("/admin/ready-goods-stock")).toBe("inventory");
    expect(getRequiredModuleForAdminPath("/admin/ready-goods-day-close")).toBe("inventory");
    expect(getRequiredModuleForAdminPath("/admin/ready-goods-reports")).toBe("inventory");
    expect(getRequiredModuleForAdminPath("/admin/production-demand-planner")).toBe("production");
    expect(getRequiredModuleForAdminPath("/admin/assembly-tv")).toBe("production");
  });

  it("maps cross-functional target-vs-actual to cmd_war_room", () => {
    expect(getRequiredModuleForAdminPath("/admin/target-vs-actual")).toBe("cmd_war_room");
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

  it("denies Dispatch roles from commercial Dispatch TV and dashboard-fallback admin routes", () => {
    expect(isAuthorizedForAdminPath("/admin/dispatch-tv", "DISPATCH_MANAGER")).toBe(false);
    expect(isAuthorizedForAdminPath("/admin/ready-goods-stock", "DISPATCH_HEAD")).toBe(false);
    expect(isAuthorizedForAdminPath("/admin", "DISPATCH_MANAGER")).toBe(true);
  });
});
