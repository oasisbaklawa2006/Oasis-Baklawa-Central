import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const source = (relativePath: string) =>
  readFileSync(resolve(process.cwd(), "src", relativePath), "utf8");

describe("Point 74 — /sales/dashboard route and role authority", () => {
  const app = source("App.tsx");
  const authRouting = source("lib/auth-routing.ts");
  const adminLayout = source("components/AdminLayout.tsx");

  it("registers the sales dashboard behind ProtectedRoute and RoleProtectedRoute", () => {
    expect(app).toContain('path="/sales/dashboard"');
    expect(app).toContain("<ProtectedRoute>");
    expect(app).toContain("<RoleProtectedRoute allowedRoles={SALES_DASHBOARD_ROLES}>");
    expect(app).toContain("<SalesDashboard />");
  });

  it("limits sales dashboard admission to admin oversight and sales executives", () => {
    expect(app).toContain('const SALES_DASHBOARD_ROLES = [...ADMIN_ONLY_ROLES, "SALES_EXECUTIVE"];');
  });

  it("lands sales executives on /sales/dashboard after auth routing", () => {
    expect(authRouting).toContain('SALES_EXECUTIVE:          "/sales/dashboard"');
  });

  it("exposes the sales console in admin navigation for authorised staff", () => {
    expect(adminLayout).toContain('to: "/sales/dashboard"');
    expect(adminLayout).toContain('moduleKey: "clients"');
  });
});
