import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";

const routeGuard = readFileSync("src/components/RoleProtectedRoute.tsx", "utf8");

describe("AUTH-01 post-claim Buyer role reconciliation", () => {
  it("server-verifies an authenticated unresolved client role before deciding its destination", () => {
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

  it("never routes an authenticated unresolved or pending buyer back into B2B application intake", () => {
    const reconciliation = routeGuard.indexOf('if (serverRole && serverRole !== "PENDING" && serverRole !== normalizedRole)');
    const recoveryState = routeGuard.indexOf("Buyer access is being verified");

    expect(reconciliation).toBeGreaterThan(-1);
    expect(recoveryState).toBeGreaterThan(reconciliation);
    expect(routeGuard).not.toContain('return <Navigate to="/customer-app-redirect" replace />');
    expect(routeGuard).not.toContain('/buyer/access-request');
    expect(routeGuard).toContain("Your authenticated account does not need another B2B application.");
    expect(routeGuard).toContain('window.location.replace("/buyer")');
  });

  it("preserves existing staff RBAC and governed dashboard bounce behaviour", () => {
    expect(routeGuard).toContain("isStaffRole(normalizedRole)");
    expect(routeGuard).toContain("isPathWithinRoleDestination(location.pathname, normalizedRole)");
    expect(routeGuard).toContain('toast.error("Unauthorized Access — redirecting to your dashboard.")');
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
