import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";

const reset = readFileSync("src/pages/ResetPassword.tsx", "utf8");
const staff = readFileSync("src/pages/StaffLogin.tsx", "utf8");

describe("WA-100 employee onboarding invitation / password return", () => {
  it("uses the same public reset callback as Core without trusting an invite query as authorization", () => {
    expect(reset).toContain('get("invite") === "1"');
    expect(reset).toContain("supabase.auth.getUser()");
    expect(reset.indexOf("supabase.auth.getUser()")).toBeLessThan(reset.indexOf("supabase.auth.updateUser({ password })"));
    expect(reset).toContain("identityError || !identity.user");
    expect(reset).toContain("invitation or password reset link is invalid or expired");
  });
  it("returns employees to the staff entry only after a successful password change", () => {
    expect(reset).toContain("supabase.auth.updateUser({ password })");
    expect(reset).toContain('supabase.auth.signOut({ scope: "local" })');
    expect(reset).toContain('navigate("/staff/login", { replace: true })');
    expect(reset).not.toContain('navigate("/login"');
    expect(reset).toContain("Activate Your Staff Account");
    expect(staff).toContain('redirectTo: `${window.location.origin}/reset-password`');
  });
});
