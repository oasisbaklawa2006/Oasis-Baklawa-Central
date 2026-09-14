import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";

const routeGuard = readFileSync("src/components/RoleProtectedRoute.tsx", "utf8");

describe("AUTH-01 post-claim Buyer role reconciliation", () => {
  it("server-verifies an authenticated unresolved client role instead of immediately bouncing Buyer UAT to the customer redirect", () => {
    expect(routeGuard).toContain("if (!user) {");
    expect(routeGuard).toContain("const record = await fetchAuthRoleRecord(user.id)");
    expect(routeGuard).toContain('if (!normalizedRole || normalizedRole === "PENDING") {');
    expect(routeGuard).toContain("if (serverRole && serverRole !== normalizedRole) {");
    expect(routeGuard).toContain("window.location.replace(getRoleDestination(serverRole));");
  });

  it("keeps unresolved users fail-closed only after the authoritative server-role check has completed", () => {
    const reconciliation = routeGuard.indexOf("if (serverRole && serverRole !== normalizedRole)");
    const unresolvedRedirect = routeGuard.lastIndexOf('return <Navigate to="/customer-app-redirect" replace />');

    expect(reconciliation).toBeGreaterThan(-1);
    expect(unresolvedRedirect).toBeGreaterThan(reconciliation);
    expect(routeGuard).toContain("if (!serverVerified) {");
  });
});
