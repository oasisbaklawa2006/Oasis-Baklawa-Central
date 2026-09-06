import { describe, expect, it } from "vitest";
import { canAccessSecurityGate } from "@/lib/auth/securityGatePolicy";
import { getAllowedModulesForRole } from "./roleAccess";
import { getRequiredModuleForAdminPath, isAuthorizedForAdminPath } from "./routeAccess";

const DISPATCH_ROLES = ["DISPATCH_MANAGER", "DISPATCH_INCHARGE", "DISPATCH_HEAD"] as const;

/** Direct URLs that must fail closed for every Dispatch role (P0 #456). */
const FORBIDDEN_ADMIN_ROUTES = [
  "/admin/execution-command-center",
  "/admin/heartbeat",
  "/admin/live-work-queues",
  "/admin/entity-graph-explorer",
  "/admin/product-intelligence-prototype",
  "/admin/customer-timeline-preview",
  "/admin/operational-search",
  "/admin/finance",
  "/admin/finance-board",
  "/admin/finance-governance",
  "/admin/clients",
  "/admin/pricing",
  "/admin/users",
  "/admin/settings",
  "/admin/audit",
  "/admin/inventory",
  "/admin/inventory-command-center",
  "/admin/carton-explorer",
  "/admin/scan-timeline",
  "/admin/order-management",
  "/admin/packing-dispatch",
  "/admin/dispatch",
  "/admin/target-vs-actual",
  "/admin/moq",
  "/admin/currency",
  "/admin/accounts-release",
  "/admin/reservation-board",
  "/admin/stock-finalization",
  "/admin/dispatch-tv",
  "/admin/ready-goods-stock",
  "/admin/ready-goods-day-close",
  "/admin/ready-goods-reports",
  "/admin/production-demand-planner",
  "/admin/assembly-tv",
] as const;

/** Five-stage Dispatch workflow surfaces that must remain reachable. */
const AUTHORIZED_DISPATCH_WORKFLOW_ROUTES = [
  { stage: "dispatch queue", path: "/admin/dispatch-mgmt" },
  { stage: "pickup alarm / readiness", path: "/admin/dispatch-readiness" },
  { stage: "packing detailing", path: "/admin/golden-chain-operator" },
  { stage: "packing scan / DPL", path: "/admin/golden-chain-operator" },
  { stage: "dispatch recording", path: "/admin/dispatch-completion" },
  { stage: "dispatch finalization", path: "/admin/dispatch-finalization" },
] as const;

describe("Dispatch RBAC — module grants (least privilege)", () => {
  it.each(DISPATCH_ROLES)("keeps %s out of cmd_war_room, orders and inventory modules", (role) => {
    const modules = getAllowedModulesForRole(role);
    expect(modules).not.toContain("cmd_war_room");
    expect(modules).not.toContain("orders");
    expect(modules).not.toContain("inventory");
    expect(modules).not.toContain("finance");
    expect(modules).not.toContain("clients");
    expect(modules).not.toContain("users");
    expect(modules).not.toContain("settings");
    expect(modules).not.toContain("audit");
    expect(modules).toContain("dispatch");
    expect(modules).toContain("packing");
  });
});

describe("Dispatch RBAC — forbidden direct-route access", () => {
  it.each(DISPATCH_ROLES.flatMap((role) => FORBIDDEN_ADMIN_ROUTES.map((path) => ({ role, path }))))(
    "blocks $role from $path",
    ({ role, path }) => {
      expect(isAuthorizedForAdminPath(path, role)).toBe(false);
    },
  );
});

describe("Dispatch RBAC — five-stage workflow (positive)", () => {
  it.each(
    DISPATCH_ROLES.flatMap((role) =>
      AUTHORIZED_DISPATCH_WORKFLOW_ROUTES.map(({ stage, path }) => ({ role, stage, path })),
    ),
  )("allows $role to reach $stage at $path", ({ role, path }) => {
    expect(isAuthorizedForAdminPath(path, role)).toBe(true);
  });

  it.each(DISPATCH_ROLES)("allows $role to reach App-Verse home without executive dashboard", (role) => {
    expect(isAuthorizedForAdminPath("/admin", role)).toBe(true);
    expect(isAuthorizedForAdminPath("/admin/heartbeat", role)).toBe(false);
  });
});

describe("Dispatch RBAC — security gate policy", () => {
  it.each(DISPATCH_ROLES)("denies %s from /security-gate (independent gate release authority)", (role) => {
    expect(canAccessSecurityGate(role)).toBe(false);
  });
});

describe("Dispatch RBAC — dashboard fallback fail-closed", () => {
  it.each(DISPATCH_ROLES)("blocks $role from unmapped dashboard-fallback route /admin/some-unmapped-page", (role) => {
    expect(isAuthorizedForAdminPath("/admin/some-unmapped-page", role)).toBe(false);
  });
});

describe("Dispatch RBAC — explicitly mapped restricted routes", () => {
  const EXPLICITLY_MAPPED_RESTRICTED_ROUTES = [
    { path: "/admin/ready-goods-stock", module: "inventory" },
    { path: "/admin/ready-goods-day-close", module: "inventory" },
    { path: "/admin/ready-goods-reports", module: "inventory" },
    { path: "/admin/production-demand-planner", module: "production" },
    { path: "/admin/assembly-tv", module: "production" },
  ] as const;

  it.each(EXPLICITLY_MAPPED_RESTRICTED_ROUTES)(
    "maps $path to $module, not dashboard fallback",
    ({ path, module }) => {
      expect(getRequiredModuleForAdminPath(path)).toBe(module);
    },
  );

  it.each(
    DISPATCH_ROLES.flatMap((role) =>
      EXPLICITLY_MAPPED_RESTRICTED_ROUTES.map(({ path }) => ({ role, path })),
    ),
  )("blocks $role from explicitly mapped restricted route $path", ({ role, path }) => {
    expect(isAuthorizedForAdminPath(path, role)).toBe(false);
  });
});

describe("Dispatch RBAC — UAT-005 finance surface regression", () => {
  const UAT_005_FORBIDDEN_FINANCE_ROUTES = [
    "/admin/finance",
    "/admin/finance-board",
    "/admin/finance-governance",
    "/admin/accounts-release",
  ] as const;

  it.each(
    DISPATCH_ROLES.flatMap((role) =>
      UAT_005_FORBIDDEN_FINANCE_ROUTES.map((path) => ({ role, path })),
    ),
  )("UAT-005: blocks $role from direct finance route $path", ({ role, path }) => {
    expect(isAuthorizedForAdminPath(path, role)).toBe(false);
  });
});

describe("Dispatch RBAC — commercial Dispatch TV audience", () => {
  const TV_DISPLAY_FORBIDDEN_ORDERS_ROUTES = [
    "/admin/order-management",
    "/admin/packing-dispatch",
    "/admin/dispatch",
    "/admin/store-coordination",
  ] as const;

  it("allows TV_DISPLAY and OPERATIONS_MANAGER to reach /admin/dispatch-tv", () => {
    expect(isAuthorizedForAdminPath("/admin/dispatch-tv", "TV_DISPLAY")).toBe(true);
    expect(isAuthorizedForAdminPath("/admin/dispatch-tv", "OPERATIONS_MANAGER")).toBe(true);
  });

  it.each(TV_DISPLAY_FORBIDDEN_ORDERS_ROUTES)(
    "denies TV_DISPLAY from other orders-mapped route %s",
    (path) => {
      expect(isAuthorizedForAdminPath(path, "TV_DISPLAY")).toBe(false);
    },
  );

  it.each(DISPATCH_ROLES)("denies %s from commercial Dispatch TV", (role) => {
    expect(isAuthorizedForAdminPath("/admin/dispatch-tv", role)).toBe(false);
  });
});

