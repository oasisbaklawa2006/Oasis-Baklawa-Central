import { describe, expect, it } from "vitest";
import { assertFinanceAuthority } from "@/lib/finance-authority/financeAuthorityGuard";
import { roleCanPerformReservationAction } from "@/lib/inventory-authority/inventoryAuthorityMatrix";
import { getAllowedModulesForRole } from "./roleAccess";
import { isAuthorizedForAdminPath } from "./routeAccess";

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
  "/admin/moq",
  "/admin/currency",
  "/admin/accounts-release",
  "/admin/reservation-board",
  "/admin/stock-finalization",
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

describe("Dispatch RBAC — backend authority fail-closed", () => {
  it.each(DISPATCH_ROLES)("denies finance review for %s", (role) => {
    const result = assertFinanceAuthority("finance:review", {
      actorRole: role,
      actorUserId: "dispatch-user",
    });
    expect(result.allowed).toBe(false);
  });

  it.each(DISPATCH_ROLES)("denies reservation board writes for %s", (role) => {
    expect(roleCanPerformReservationAction(role, "reservation:create", "reservation_board")).toBe(false);
    expect(roleCanPerformReservationAction(role, "reservation:reserve", "reservation_board")).toBe(false);
  });
});
