import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";

// AUTH SURFACE CONTRACT — public Buyer welcome, passwordless Buyer OTP login,
// and restricted Oasis employee email/password login remain separate surfaces.

const authEntry = readFileSync("src/pages/AuthEntry.tsx", "utf8");
const buyerLogin = readFileSync("src/pages/BuyerLogin.tsx", "utf8");
const staffLogin = readFileSync("src/pages/StaffLogin.tsx", "utf8");
const appSource = readFileSync("src/App.tsx", "utf8");
const authFlowSource = readFileSync("src/lib/auth-flow.ts", "utf8");
const authLoggingSource = readFileSync("src/lib/auth-logging.ts", "utf8");

describe("Requirement 1 — /login is the public Buyer welcome entry", () => {
  it("routes /login to AuthEntry", () => {
    expect(appSource).toContain('<Route path="/login" element={<AuthEntry />} />');
  });

  it("renders Buyer welcome actions but no credential fields", () => {
    expect(authEntry).not.toContain('type="password"');
    expect(authEntry).not.toContain('type="email"');
    expect(authEntry).not.toContain("initSendOTP");
    expect(authEntry).not.toContain("signInWithPassword");
    expect(authEntry).toContain('navigate("/buyer/login")');
    expect(authEntry).toContain('navigate("/staff/login")');
    expect(authEntry).toContain("Log in");
    expect(authEntry).toContain("Admin Access");
    expect(authEntry).toContain("Request B2B Access");
    expect(authEntry).toContain("Language and currency");
  });

  it("keeps language/currency preferences on the same public route", () => {
    expect(authEntry).toContain('searchParams.get("view") === "preferences"');
    expect(authEntry).toContain('setLang("en")');
    expect(authEntry).toContain('setLang("hi")');
    expect(authEntry).toContain('setCurrency("INR")');
    expect(authEntry).toContain('setCurrency("USD")');
  });
});

describe("Requirement 2/3 — /buyer/login is passwordless Buyer authentication", () => {
  it("routes /buyer/login to BuyerLogin", () => {
    expect(appSource).toContain('<Route path="/buyer/login" element={<BuyerLogin />} />');
  });

  it("supports certified MSG91 mobile OTP", () => {
    expect(buyerLogin).toContain("initSendOTP");
    expect(buyerLogin).toContain("Secure Mobile Verification");
    expect(buyerLogin).toContain("MSG91_WIDGET_ID");
    expect(buyerLogin).toContain('method: AuthAttemptMethod = "mobile_otp"');
    expect(buyerLogin).toContain('supabase.functions.invoke("msg91-otp"');
  });

  it("supports Supabase email OTP without creating unknown users", () => {
    expect(authLoggingSource).toContain('"email_otp"');
    expect(buyerLogin).toContain('method: AuthAttemptMethod = "email_otp"');
    expect(buyerLogin).toContain("supabase.auth.signInWithOtp");
    expect(buyerLogin).toContain("shouldCreateUser: false");
    expect(buyerLogin).toContain("emailRedirectTo: resolveBuyerEmailOtpRedirectUrl()");
    expect(buyerLogin).toContain("resolveBuyerEmailOtpRedirectUrl");
    expect(buyerLogin).not.toContain("b2b.oasisbaklawa.com");
    expect(buyerLogin).toContain("supabase.auth.verifyOtp");
    expect(buyerLogin).toContain('type: "email"');
    expect(buyerLogin).toContain("Email OTP");
  });

  it("never renders or uses a Buyer password", () => {
    expect(buyerLogin).not.toContain('type="password"');
    expect(buyerLogin).not.toContain("signInWithPassword");
    expect(buyerLogin).not.toContain("resetPasswordForEmail");
  });

  it("carries Buyer fallbacks and the employee entry link", () => {
    expect(buyerLogin).toContain('navigate("/buyer/access-request")');
    expect(buyerLogin).toContain("Request B2B Access");
    expect(buyerLogin).toContain("WhatsApp Oasis");
    expect(buyerLogin).toContain("Call Oasis");
    expect(buyerLogin).toContain("Admin Access");
    expect(buyerLogin).toContain('navigate("/staff/login")');
  });

  it("enforces the Buyer membership boundary through the shared redirect helper", () => {
    expect(buyerLogin).toContain('requiredMembership: "buyer"');
  });
});

describe("Requirement 4/5/6 — /staff/login is restricted employee-only auth", () => {
  it("routes /staff/login to StaffLogin", () => {
    expect(appSource).toContain('<Route path="/staff/login" element={<StaffLogin />} />');
  });

  it("renders employee email/password login and restricted-entry warning", () => {
    expect(staffLogin).toContain('showPwd ? "text" : "password"');
    expect(staffLogin).toContain("signInWithPassword");
    expect(staffLogin).toContain("Employee Access");
    expect(staffLogin).toContain("Restricted employee entry");
  });

  it("does not render Buyer onboarding or OTP controls", () => {
    expect(staffLogin).not.toContain("Apply for B2B Access");
    expect(staffLogin).not.toContain("Request B2B Access");
    expect(staffLogin).not.toContain('navigate("/buyer/access-request")');
    expect(staffLogin).not.toContain("initSendOTP");
    expect(staffLogin).not.toContain("ensureMsg91Provider");
    expect(staffLogin).not.toContain("MSG91_WIDGET_ID");
    expect(staffLogin).not.toContain('method: AuthAttemptMethod = "email_otp"');
  });

  it("offers an explicit return to B2B login", () => {
    expect(staffLogin).toContain("Return to B2B Login");
    expect(staffLogin).toContain('navigate("/buyer/login")');
  });

  it("enforces the staff membership boundary through the shared redirect helper", () => {
    expect(staffLogin).toContain('requiredMembership: "staff"');
  });
});

describe("Requirement 12 — Admin/Super Admin routing is role-derived only", () => {
  it("App.tsx no longer hard-codes an admin identity redirect", () => {
    expect(appSource).not.toContain("ADMIN_EXPRESS_EMAILS");
    expect(appSource).not.toContain("ADMIN_EXPRESS_PHONES");
    expect(appSource).not.toContain("isAdminExpressUser");
    expect(appSource).not.toContain("admin@oasisbaklawa.com");
    expect(appSource).not.toContain("9891162212");
  });

  it("the shared redirect helper carries no identity-based admin branch", () => {
    expect(authFlowSource).not.toContain("admin@oasisbaklawa.com");
    expect(authFlowSource).not.toContain("9891162212");
    expect(authFlowSource).not.toContain("isAdminExpress");
  });

  it("no login surface hard-codes an admin identity redirect", () => {
    for (const source of [buyerLogin, staffLogin, authEntry]) {
      expect(source).not.toContain("admin@oasisbaklawa.com");
      expect(source).not.toContain("9891162212");
      expect(source).not.toContain("isAdminExpress");
    }
  });

  it("redirectAfterAuth navigates only to the role-derived destination", () => {
    const start = authFlowSource.indexOf("export async function redirectAfterAuth");
    const body = authFlowSource.slice(start, authFlowSource.indexOf("\n}", authFlowSource.lastIndexOf("params.navigate(result.destination")));
    expect(body).toContain("params.navigate(result.destination");
    expect(body).not.toContain('"/admin/cmd-war-room"');
  });
});

describe("MSG91 client-side configuration classification", () => {
  it("BuyerLogin documents the widget-config vs provider-secret boundary", () => {
    expect(buyerLogin).toContain("MSG91_WIDGET_ID");
    expect(buyerLogin).toContain("MSG91_TOKEN_AUTH");
    expect(buyerLogin).toContain("not the MSG91");
  });

  it("no login surface embeds an MSG91 server-side authkey variable name", () => {
    for (const source of [buyerLogin, staffLogin, authEntry]) {
      expect(source).not.toContain("MSG91_AUTH_KEY");
    }
  });
});

describe("Requirement 7 (follow-up) — staff password reset uses the current app origin", () => {
  it("StaffLogin no longer hard-codes the B2B reset hostname", () => {
    expect(staffLogin).not.toContain("b2b.oasisbaklawa.com");
    expect(staffLogin).toContain("`${window.location.origin}/reset-password`");
  });
});

describe("Requirement 8 (follow-up) — Buyer email OTP redirect stays on Central", () => {
  it("BuyerLogin passes a Central-origin emailRedirectTo and restores magic-link sessions on /buyer/login", () => {
    expect(buyerLogin).toContain('url.searchParams.get("manual_auth") === "true"');
    expect(buyerLogin).toContain("supabase.auth.setSession({ access_token, refresh_token })");
    expect(buyerLogin).toContain("emailRedirectTo: resolveBuyerEmailOtpRedirectUrl()");
    expect(buyerLogin).not.toContain("b2b.oasisbaklawa.com");
  });
});

describe("Requirement 10 (follow-up) — /buyer/login and /staff/login remain separate lazy routes", () => {
  it("App.tsx lazy-loads BuyerLogin and StaffLogin as distinct chunks", () => {
    expect(appSource).toMatch(/const BuyerLogin\s*=\s*lazy\(\s*\(\)\s*=>\s*import\(["']\.\/pages\/BuyerLogin\.tsx["']\)\s*\)/);
    expect(appSource).toMatch(/const StaffLogin\s*=\s*lazy\(\s*\(\)\s*=>\s*import\(["']\.\/pages\/StaffLogin\.tsx["']\)\s*\)/);
  });
});
