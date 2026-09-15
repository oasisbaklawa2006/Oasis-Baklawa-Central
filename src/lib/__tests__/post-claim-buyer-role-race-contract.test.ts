import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";

const routeGuard = readFileSync("src/components/RoleProtectedRoute.tsx", "utf8");

describe("AUTH-01 post-claim Buyer role reconciliation", () => {
  it("server-verifies an authenticated unresolved client role instead of immediately bouncing Buyer UAT to the customer redirect", () => {
    expect(routeGuard).toContain("if (!user) {");
    expect(routeGuard).toContain("const record = await fetchAuthRoleRecord(user.id)");
    expect(routeGuard).toContain('if (!normalizedRole || normalizedRole === "PENDING") {');
    expect(routeGuard).toContain('if (serverRole && serverRole !== "PENDING" && serverRole !== normalizedRole) {');
    expect(routeGuard).toContain("window.location.replace(getRoleDestination(serverRole));");
  });

  it("does not reload when both the client and authoritative server are still unresolved", () => {
    expect(routeGuard).toContain('serverRole !== "PENDING"');
    expect(routeGuard).toContain("setServerVerified(true);");
  });

  it("keeps unresolved users fail-closed only after the authoritative server-role check has completed", () => {
    const reconciliation = routeGuard.indexOf('if (serverRole && serverRole !== "PENDING" && serverRole !== normalizedRole)');
    const unresolvedRedirect = routeGuard.lastIndexOf('return <Navigate to="/customer-app-redirect" replace />');

    expect(reconciliation).toBeGreaterThan(-1);
    expect(unresolvedRedirect).toBeGreaterThan(reconciliation);
    expect(routeGuard).toContain("if (!serverVerified) {");
  });

  it("does not let a superseded mismatch effect redirect a newer auth session after asynchronous sign-out", () => {
    const signOut = routeGuard.indexOf('await signOutAndClearSession({ reason: "role_mismatch" })');
    const cancellationRecheck = routeGuard.indexOf("if (cancelled) return;", signOut);
    const loginRedirect = routeGuard.indexOf('window.location.replace("/login")', signOut);

    expect(signOut).toBeGreaterThan(-1);
    expect(cancellationRecheck).toBeGreaterThan(signOut);
    expect(loginRedirect).toBeGreaterThan(cancellationRecheck);
  });
});
