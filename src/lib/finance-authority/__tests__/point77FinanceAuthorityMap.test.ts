import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { getAllowedModulesForRole, hasModuleAccess } from "@/lib/appverse/roleAccess";
import { getRequiredModuleForAdminPath, isAuthorizedForAdminPath } from "@/lib/appverse/routeAccess";
import { hasAdminModuleAccess } from "@/lib/auth/adminModuleAccess";
import {
  FINANCE_CANONICAL_SURFACES,
  FINANCE_LEGACY_REDIRECTS,
  FINANCE_MODULE_ROUTES,
  FINANCE_UNAVAILABLE_CAPABILITIES,
  getCanonicalFinanceEgressRoute,
  getCanonicalFinanceIngressRoute,
  getFinanceSurfaceByRoute,
  isFinanceCapabilityAvailable,
} from "../financeAuthorityMap";

const source = (relativePath: string) =>
  readFileSync(resolve(process.cwd(), relativePath), "utf8");

describe("Point 77 — Finance canonical authority map", () => {
  it("declares exactly one canonical ingress and one canonical egress surface", () => {
    const ingress = FINANCE_CANONICAL_SURFACES.filter((s) => s.legacyDisposition === "canonical" && s.lifecycle === "ingress");
    const egress = FINANCE_CANONICAL_SURFACES.filter((s) => s.legacyDisposition === "canonical" && s.lifecycle === "egress");
    expect(ingress).toHaveLength(1);
    expect(egress).toHaveLength(1);
    expect(getCanonicalFinanceIngressRoute()).toBe("/admin/finance-board");
    expect(getCanonicalFinanceEgressRoute()).toBe("/admin/accounts-release");
  });

  it("maps every finance module route to a surface definition", () => {
    for (const route of FINANCE_MODULE_ROUTES) {
      expect(getFinanceSurfaceByRoute(route)).toBeDefined();
    }
  });

  it("marks unavailable capabilities that have no Core RPC", () => {
    expect(isFinanceCapabilityAvailable("commission_payout")).toBe(false);
    expect(isFinanceCapabilityAvailable("orders_payment_status_direct_write")).toBe(false);
    expect(isFinanceCapabilityAvailable("orders_awaiting_final_payment_direct_write")).toBe(false);
    expect(FINANCE_UNAVAILABLE_CAPABILITIES.size).toBeGreaterThanOrEqual(4);
  });

  it("keeps legacy AdminFinance as supporting with quarantined write boundary", () => {
    const legacy = getFinanceSurfaceByRoute("/admin/finance");
    expect(legacy?.legacyDisposition).toBe("supporting");
    expect(legacy?.writeBoundary).toBe("quarantined");
    expect(legacy?.redirectTo).toBe("/admin/finance-board");
    expect(legacy?.unavailableCapabilities).toContain("final invoice issuance (use /admin/accounts-release)");
  });

  it("documents legacy bookmark redirects without independent authority", () => {
    expect(FINANCE_LEGACY_REDIRECTS["/admin/finance/payments"]).toBe("/admin/finance");
    expect(FINANCE_LEGACY_REDIRECTS["/admin/finance/invoices"]).toBe("/admin/finance");
  });
});

describe("Point 77 — Finance route/module authority", () => {
  const FINANCE_ROLES = ["FINANCE_HEAD", "FINANCE_EXEC", "ADMIN", "SUPER_ADMIN"] as const;
  const DISPATCH_ROLES = ["DISPATCH_MANAGER", "DISPATCH_INCHARGE", "DISPATCH_HEAD"] as const;

  it.each(FINANCE_ROLES)("allows %s to reach canonical finance ingress and egress", (role) => {
    expect(isAuthorizedForAdminPath("/admin/finance-board", role)).toBe(true);
    expect(isAuthorizedForAdminPath("/admin/accounts-release", role)).toBe(true);
    expect(isAuthorizedForAdminPath("/admin/finance-governance", role)).toBe(true);
  });

  it.each(DISPATCH_ROLES)("blocks %s from all finance module routes (Dispatch/Gate isolation)", (role) => {
    for (const route of FINANCE_MODULE_ROUTES) {
      expect(isAuthorizedForAdminPath(route, role)).toBe(false);
    }
  });

  it("aligns adminModuleAccess finance_audit with appverse roleAccess", () => {
    for (const role of ["FINANCE_HEAD", "FINANCE_EXEC"] as const) {
      expect(hasAdminModuleAccess(role, "finance_audit")).toBe(true);
      expect(hasModuleAccess(getAllowedModulesForRole(role), "finance_audit")).toBe(true);
    }
  });

  it("maps finance routes to correct module keys", () => {
    expect(getRequiredModuleForAdminPath("/admin/finance-board")).toBe("finance");
    expect(getRequiredModuleForAdminPath("/admin/accounts-release")).toBe("accounts");
    expect(getRequiredModuleForAdminPath("/admin/finance-governance")).toBe("finance_audit");
    expect(getRequiredModuleForAdminPath("/admin/finance")).toBe("finance");
  });
});

describe("Point 77 — Core-only writes on canonical surfaces", () => {
  it("AdminFinance removes direct orders.payment_status and awaiting_final_payment shadow writes", () => {
    const page = source("src/pages/admin/AdminFinance.tsx");
    expect(page).not.toMatch(/from\(["']orders["']\)[\s\S]{0,120}\.update\([\s\S]{0,120}payment_status:\s*["']awaiting_advance["']/);
    expect(page).not.toMatch(/from\(["']orders["']\)[\s\S]{0,120}\.update\([\s\S]{0,120}status:\s*["']awaiting_final_payment["']/);
    expect(page).toContain("confirmPrepaidOrderAwaitingAdvance");
    expect(page).toContain("getCanonicalFinanceEgressRoute");
  });

  it("FinanceReleaseBoard uses only governed payment and release RPC clients", () => {
    const page = source("src/pages/admin/FinanceReleaseBoard.tsx");
    expect(page).toContain("verifyPayment");
    expect(page).toContain("releaseOrderToInProduction");
    expect(page).not.toMatch(/from\(["']orders["']\)[\s\S]{0,80}\.update\(/);
    expect(page).not.toMatch(/from\(["']order_payments["']\)/);
  });

  it("AdminAccountsRelease binds egress to governed finance-exit RPCs only", () => {
    const page = source("src/pages/admin/AdminAccountsRelease.tsx");
    for (const governed of [
      "receiveSubmittedB2bDpls",
      "issueFinalInvoice",
      "decideFinanceDispatchClearance",
      "clearOrderForDispatch",
    ]) {
      expect(page).toContain(governed);
    }
    expect(page).not.toMatch(/from\(["']orders["']\)[\s\S]{0,80}\.update\(/);
  });

  it("quarantines commission payouts without Core RPC", () => {
    const page = source("src/pages/admin/AdminFinance.tsx");
    expect(page).toContain('isFinanceCapabilityAvailable("commission_payout")');
    expect(page).toContain("record_commission_payout_v1");
  });
});

describe("Point 77 — legacy route disposition", () => {
  it("registers finance-board in AdminLayout navigation", () => {
    const layout = source("src/components/AdminLayout.tsx");
    expect(layout).toContain('to: "/admin/finance-board"');
    expect(layout).toContain("Finance release board");
  });

  it("App.tsx retains legacy bookmark redirects for finance subpaths", () => {
    const app = source("src/App.tsx");
    expect(app).toContain('path="finance/payments"');
    expect(app).toContain('path="finance/invoices"');
    expect(app).toContain('to="/admin/finance"');
  });
});
