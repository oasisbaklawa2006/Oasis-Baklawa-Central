import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { getRoleDestination } from "@/lib/auth-routing";
import AdminModuleRoute from "../AdminModuleRoute";

let mockRole = "STORE_READY_GOODS";
vi.mock("@/hooks/useAuth", () => ({ useAuth: () => ({ role: mockRole }) }));

function renderAt(pathname: string) {
  return render(
    <MemoryRouter initialEntries={[pathname]}>
      <Routes>
        <Route
          path="/admin/3pgs-procurement-queue"
          element={
            <AdminModuleRoute moduleKey="inventory">
              <div>3PGS queue content</div>
            </AdminModuleRoute>
          }
        />
        <Route
          path="/admin/3pgs-visibility"
          element={
            <AdminModuleRoute moduleKey="inventory">
              <div>3PGS satellite content</div>
            </AdminModuleRoute>
          }
        />
        <Route
          path="/admin/3pgs-mobile-urgent"
          element={
            <AdminModuleRoute moduleKey="inventory">
              <div>3PGS mobile urgent content</div>
            </AdminModuleRoute>
          }
        />
        <Route
          path="/admin/3pgs-tv"
          element={
            <AdminModuleRoute moduleKey="inventory">
              <div>3PGS TV content</div>
            </AdminModuleRoute>
          }
        />
        <Route path="/admin" element={<div>Admin landing</div>} />
        <Route path="/sales/dashboard" element={<div>Sales dashboard</div>} />
        <Route path="/tv/3pgs" element={<div>Kiosk 3PGS TV</div>} />
        <Route path="/admin/ready-goods" element={<div>Ready goods landing</div>} />
        <Route path="/admin/dispatch-mgmt" element={<div>Dispatch landing</div>} />
      </Routes>
    </MemoryRouter>,
  );
}

describe("AdminModuleRoute 3PGS operator gate", () => {
  it("blocks a role with generic inventory access but no 3PGS operator authority", () => {
    mockRole = "STORE_READY_GOODS";
    renderAt("/admin/3pgs-procurement-queue");
    expect(screen.queryByText("3PGS queue content")).toBeNull();
    expect(screen.getByText("Ready goods landing")).toBeTruthy();
  });

  // React Router v6 matches a route registered without a trailing slash
  // against a request path that has one; the gate must not be bypassable
  // by a trailing slash reaching the same rendered route.
  it("still blocks a role with generic inventory access when the request path carries a trailing slash", () => {
    mockRole = "STORE_READY_GOODS";
    renderAt("/admin/3pgs-procurement-queue/");
    expect(screen.queryByText("3PGS queue content")).toBeNull();
    expect(screen.getByText("Ready goods landing")).toBeTruthy();
  });

  it("admits a genuine 3PGS operator role", () => {
    mockRole = "STORE_3RD_PARTY";
    renderAt("/admin/3pgs-procurement-queue");
    expect(screen.getByText("3PGS queue content")).toBeTruthy();
  });

  it("admits a genuine 3PGS operator role even with a trailing slash", () => {
    mockRole = "STORE_3RD_PARTY";
    renderAt("/admin/3pgs-procurement-queue/");
    expect(screen.getByText("3PGS queue content")).toBeTruthy();
  });

  // normalizePathname must strip every trailing slash, not just one --
  // React Router still matches the route against a request path carrying
  // repeated trailing slashes.
  it("still blocks a role with generic inventory access when the request path carries repeated trailing slashes", () => {
    mockRole = "STORE_READY_GOODS";
    renderAt("/admin/3pgs-procurement-queue//");
    expect(screen.queryByText("3PGS queue content")).toBeNull();
    expect(screen.getByText("Ready goods landing")).toBeTruthy();
  });

  it("admits a genuine 3PGS operator role even with repeated trailing slashes", () => {
    mockRole = "STORE_3RD_PARTY";
    renderAt("/admin/3pgs-procurement-queue//");
    expect(screen.getByText("3PGS queue content")).toBeTruthy();
  });
});

describe("AdminModuleRoute 3PGS satellite visibility gate", () => {
  it.each([
    ["HOD_ASSEMBLY", "pna"],
    ["ASSEMBLY_MANAGER", "pna"],
    ["PACKING_SUPERVISOR", "pna"],
    ["STORE_READY_GOODS", "outlet"],
    ["STORE_INCHARGE", "outlet"],
    ["RGS_ADMIN", "outlet"],
    ["DISPATCH_HEAD", "dispatch"],
    ["DISPATCH_MANAGER", "dispatch"],
    ["DISPATCH_INCHARGE", "dispatch"],
  ] as const)("admits %s (%s audience) without generic inventory module access", (role, _audience) => {
    mockRole = role;
    renderAt("/admin/3pgs-visibility");
    expect(screen.getByText("3PGS satellite content")).toBeTruthy();
  });

  it("redirects SALES_EXECUTIVE to the sales dashboard instead of widening admin access", () => {
    mockRole = "SALES_EXECUTIVE";
    renderAt("/admin/3pgs-visibility");
    expect(screen.queryByText("3PGS satellite content")).toBeNull();
    expect(screen.getByText("Sales dashboard")).toBeTruthy();
    expect(getRoleDestination("SALES_EXECUTIVE")).toBe("/sales/dashboard");
  });

  it.each([
    "HOD_ASSEMBLY",
    "DISPATCH_INCHARGE",
    "STORE_READY_GOODS",
  ] as const)("keeps %s off the operator procurement queue", (role) => {
    mockRole = role;
    renderAt("/admin/3pgs-procurement-queue");
    expect(screen.queryByText("3PGS queue content")).toBeNull();
  });

  it.each([
    "HOD_ASSEMBLY",
    "DISPATCH_INCHARGE",
  ] as const)("keeps %s off the mobile urgent surface", (role) => {
    mockRole = role;
    renderAt("/admin/3pgs-mobile-urgent");
    expect(screen.queryByText("3PGS mobile urgent content")).toBeNull();
  });

  it.each([
    "HOD_ASSEMBLY",
    "DISPATCH_INCHARGE",
  ] as const)("keeps %s off the admin-shell TV surface", (role) => {
    mockRole = role;
    renderAt("/admin/3pgs-tv");
    expect(screen.queryByText("3PGS TV content")).toBeNull();
  });
});

describe("AdminModuleRoute 3PGS TV gate", () => {
  it.each([
    "DISPATCH_MANAGER",
    "DISPATCH_HEAD",
    "STORE_READY_GOODS",
    "STORE_INCHARGE",
    "RGS_ADMIN",
  ] as const)("blocks %s from the unfiltered admin-shell 3PGS TV route", (role) => {
    mockRole = role;
    renderAt("/admin/3pgs-tv");
    expect(screen.queryByText("3PGS TV content")).toBeNull();
  });

  it("admits STORE_3RD_PARTY to the admin-shell 3PGS TV route", () => {
    mockRole = "STORE_3RD_PARTY";
    renderAt("/admin/3pgs-tv");
    expect(screen.getByText("3PGS TV content")).toBeTruthy();
  });

  it("blocks kiosk-only TV_3PGS from the admin-shell alias while preserving the kiosk predicate", () => {
    mockRole = "TV_3PGS";
    renderAt("/admin/3pgs-tv");
    expect(screen.queryByText("3PGS TV content")).toBeNull();
    expect(screen.getByText("Kiosk 3PGS TV")).toBeTruthy();
    expect(getRoleDestination("TV_3PGS")).toBe("/tv/3pgs");
  });
});

function renderFinanceAt(pathname: string) {
  return render(
    <MemoryRouter initialEntries={[pathname]}>
      <Routes>
        <Route
          path="/admin/finance"
          element={
            <AdminModuleRoute moduleKey="finance">
              <div>Finance workspace</div>
            </AdminModuleRoute>
          }
        />
        <Route
          path="/admin/finance-governance"
          element={
            <AdminModuleRoute moduleKey="finance_audit">
              <div>Finance governance workspace</div>
            </AdminModuleRoute>
          }
        />
        <Route
          path="/admin/accounts-release"
          element={
            <AdminModuleRoute moduleKey="accounts">
              <div>Accounts release workspace</div>
            </AdminModuleRoute>
          }
        />
        <Route path="/admin" element={<div>Admin landing</div>} />
        <Route path="/admin/dispatch-mgmt" element={<div>Dispatch landing</div>} />
        <Route path="/customer-app-redirect" element={<div>Customer redirect</div>} />
      </Routes>
    </MemoryRouter>,
  );
}

describe("AdminModuleRoute finance surface gate (UAT-005)", () => {
  it.each(["DISPATCH_MANAGER", "DISPATCH_INCHARGE", "DISPATCH_HEAD"] as const)(
    "blocks %s from /admin/finance",
    (role) => {
      mockRole = role;
      renderFinanceAt("/admin/finance");
      expect(screen.queryByText("Finance workspace")).not.toBeInTheDocument();
      expect(screen.getByText("Dispatch landing")).toBeInTheDocument();
    },
  );

  it.each(["DISPATCH_MANAGER", "DISPATCH_INCHARGE", "DISPATCH_HEAD"] as const)(
    "blocks %s from /admin/finance-governance",
    (role) => {
      mockRole = role;
      renderFinanceAt("/admin/finance-governance");
      expect(screen.queryByText("Finance governance workspace")).not.toBeInTheDocument();
      expect(screen.getByText("Dispatch landing")).toBeInTheDocument();
    },
  );

  it.each(["DISPATCH_MANAGER", "DISPATCH_INCHARGE", "DISPATCH_HEAD"] as const)(
    "blocks %s from /admin/accounts-release",
    (role) => {
      mockRole = role;
      renderFinanceAt("/admin/accounts-release");
      expect(screen.queryByText("Accounts release workspace")).not.toBeInTheDocument();
      expect(screen.getByText("Dispatch landing")).toBeInTheDocument();
    },
  );

  it("admits FINANCE_HEAD to /admin/finance", () => {
    mockRole = "FINANCE_HEAD";
    renderFinanceAt("/admin/finance");
    expect(screen.getByText("Finance workspace")).toBeTruthy();
  });

  it("preserves customer-app-redirect for unknown roles denied finance access", () => {
    mockRole = "UNKNOWN_ROLE";
    renderFinanceAt("/admin/finance");
    expect(screen.queryByText("Finance workspace")).not.toBeInTheDocument();
    expect(screen.getByText("Customer redirect")).toBeInTheDocument();
  });
});
