import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";

// AUTH SURFACE CONTRACT — public Buyer welcome, gated passwordless Buyer OTP
// login, and restricted Oasis employee email/password login remain separate.

const authEntry = readFileSync("src/pages/AuthEntry.tsx", "utf8");
const buyerLogin = readFileSync("src/pages/BuyerLogin.tsx", "utf8");
const staffLogin = readFileSync("src/pages/StaffLogin.tsx", "utf8");
const appSource = readFileSync("src/App.tsx", "utf8");
const authFlowSource = readFileSync("src/lib/auth-flow.ts", "utf8");
const authLoggingSource = readFileSync("src/lib/auth-logging.ts", "utf8");
const gatewaySource = readFileSync("supabase/functions/buyer-login-gateway/index.ts", "utf8");

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
});

describe("Requirement 2/3 — /buyer/login is passwordless Buyer authentication", () => {
  it("routes /buyer/login to BuyerLogin", () => {
    expect(appSource).toContain('<Route path="/buyer/login" element={<BuyerLogin />} />');
  });

  it("supports certified MSG91 mobile OTP behind Buyer eligibility preflight", () => {
    expect(buyerLogin).toContain("initSendOTP");
    expect(buyerLogin).toContain("Secure Mobile Verification");
    expect(buyerLogin).toContain("MSG91_WIDGET_ID");
    expect(buyerLogin).toContain('method: AuthAttemptMethod = "mobile_otp"');
    expect(buyerLogin).toContain('supabase.functions.invoke("buyer-login-gateway"');
    expect(buyerLogin).toContain('mode: "preflight"');
    expect(buyerLogin).toContain('supabase.functions.invoke("msg91-otp"');
  });

  it("uses a governed numeric email OTP with no legacy portal redirect", () => {
    expect(authLoggingSource).toContain('"email_otp"');
    expect(buyerLogin).toContain('method: AuthAttemptMethod = "email_otp"');
    expect(buyerLogin).toContain('mode: "email_otp_send"');
    expect(buyerLogin).toContain('channel: "email"');
    expect(buyerLogin).toContain("supabase.auth.verifyOtp");
    expect(buyerLogin).toContain('type: "email"');
    expect(buyerLogin).toContain("Email OTP");
    expect(buyerLogin).not.toContain("b2b.oasisbaklawa.com");
    expect(gatewaySource).toContain("auth.admin.generateLink");
    expect(gatewaySource).toContain("email_otp");
    expect(gatewaySource).not.toContain("action_link");
  });

  it("gates unknown, pending and employee identities before OTP", () => {
    expect(gatewaySource).toContain('state: "unknown"');
    expect(gatewaySource).toContain('state: "pending"');
    expect(gatewaySource).toContain('state: "employee"');
    expect(gatewaySource).toContain("Employees must use Admin Login");
    expect(buyerLogin).toContain("applyEligibility");
    expect(buyerLogin).toContain('navigate("/staff/login")');
    expect(buyerLogin).toContain('navigate("/buyer/access-request")');
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
    expect(buyerLogin).toContain("claimApprovedB2bIdentityForAuthenticatedSession");
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
});

describe("MSG91 client/server configuration boundary", () => {
  it("BuyerLogin carries only widget configuration while server authkey remains Edge-only", () => {
    expect(buyerLogin).toContain("MSG91_WIDGET_ID");
    expect(buyerLogin).toContain("MSG91_TOKEN_AUTH");
    expect(buyerLogin).not.toContain("MSG91_AUTH_KEY");
    expect(gatewaySource).toContain("MSG91_AUTH_KEY");
  });
});
