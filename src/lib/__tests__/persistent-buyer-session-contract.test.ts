import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";

const supabaseClient = readFileSync("src/integrations/supabase/client.ts", "utf8");
const authProvider = readFileSync("src/hooks/useAuth.tsx", "utf8");
const app = readFileSync("src/App.tsx", "utf8");

describe("persistent Buyer session / launch contract", () => {
  it("persists and automatically refreshes the Supabase authenticated session", () => {
    expect(supabaseClient).toContain("persistSession: true");
    expect(supabaseClient).toContain("autoRefreshToken: true");
  });

  it("restores the current Supabase session on app boot and re-resolves the authenticated UUID", () => {
    expect(authProvider).toContain("supabase.auth.getSession()");
    expect(authProvider).toContain('void syncSession(session, "session_restore")');
    expect(authProvider).toContain("bootstrapUser(nextUser");
    expect(authProvider).toContain('.eq("id", activeUser.id)');
    expect(authProvider).toContain("fetchAuthRoleRecord(activeUser.id)");
  });

  it("holds routing until restored profile authorization is ready", () => {
    expect(app).toContain("if (authLoading || (user && !profileReady))");
    expect(app).toContain("return <AuthSpinner />");
  });

  it("routes an authenticated app launch from the restored role instead of requiring a fresh login", () => {
    expect(app).toContain('if (!user) return <Navigate to="/login" replace />');
    expect(app).toContain("return <Navigate to={getRoleDestination(normalizedRole)} replace />");
    expect(app).toContain('path="/" element={<RootGate />}');
  });

  it("keeps Buyer screens behind authenticated role authorization", () => {
    expect(app).toContain('path="/buyer/*"');
    expect(app).toContain("<ProtectedRoute>");
    expect(app).toContain('allowedRoles={["B2B_BUYER", "SPECIAL_BUYER", "HORECA_BUYER", "WHOLESALE_BUYER", "BULK_BUYER", "BUYER", "CLIENT", "CUSTOMER_USER"]}');
  });
});
