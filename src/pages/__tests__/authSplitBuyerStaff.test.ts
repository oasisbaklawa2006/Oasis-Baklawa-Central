import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";

const authEntry = readFileSync("src/pages/AuthEntry.tsx", "utf8");
const buyerLogin = readFileSync("src/pages/BuyerLogin.tsx", "utf8");
const staffLogin = readFileSync("src/pages/StaffLogin.tsx", "utf8");
const appSource = readFileSync("src/App.tsx", "utf8");
const authFlowSource = readFileSync("src/lib/auth-flow.ts", "utf8");
const gatewaySource = readFileSync("supabase/functions/buyer-login-gateway/index.ts", "utf8");
const emailBridgeSource = readFileSync("supabase/functions/msg91-email-session/index.ts", "utf8");

describe("public and staff auth surface split", () => {
  it("keeps /login as the public Buyer welcome entry", () => {
    expect(appSource).toContain('<Route path="/login" element={<AuthEntry />} />');
    expect(authEntry).toContain('navigate("/buyer/login")');
    expect(authEntry).toContain('navigate("/staff/login")');
    expect(authEntry).not.toContain("signInWithPassword");
  });

  it("keeps /staff/login employee-only email/password auth", () => {
    expect(appSource).toContain('<Route path="/staff/login" element={<StaffLogin />} />');
    expect(staffLogin).toContain("signInWithPassword");
    expect(staffLogin).toContain("Restricted employee entry");
    expect(staffLogin).not.toContain("MSG91_WIDGET_ID");
    expect(staffLogin).toContain('requiredMembership: "staff"');
  });
});

describe("Buyer login eligibility gate", () => {
  it("classifies before OTP and never mutates identity in the preflight gateway", () => {
    expect(buyerLogin).toContain('supabase.functions.invoke("buyer-login-gateway"');
    expect(buyerLogin).toContain('mode: "preflight"');
    expect(gatewaySource).toContain("Employees must use Admin Login");
    expect(gatewaySource).toContain('result("pending"');
    expect(gatewaySource).toContain('result("unknown"');
    expect(gatewaySource).toContain('result("approved"');
    expect(gatewaySource).not.toContain("auth.admin.createUser");
    expect(gatewaySource).not.toContain("auth.admin.generateLink");
    expect(gatewaySource).not.toContain("insert(");
    expect(gatewaySource).not.toContain("upsert(");
  });

  it("routes employee and unknown Buyer attempts to the correct next surface", () => {
    expect(buyerLogin).toContain('navigate("/staff/login")');
    expect(buyerLogin).toContain('navigate("/buyer/access-request")');
    expect(buyerLogin).toContain("Go to Admin Login");
    expect(buyerLogin).toContain("Request B2B Access");
  });
});

describe("Buyer mobile and email OTP", () => {
  it("uses the same MSG91 SDK for both approved channels", () => {
    expect(buyerLogin).toContain("window.sendOtp");
    expect(buyerLogin).toContain("window.verifyOtp");
    expect(buyerLogin).toContain('await requestProviderOtp(`91${phone.last10}`, "mobile"');
    expect(buyerLogin).toContain('await requestProviderOtp(trimmedEmail, "email"');
    expect(buyerLogin).toContain('"mobile_otp"');
    expect(buyerLogin).toContain('"email_otp"');
  });

  it("does not use Buyer passwords or magic-link navigation", () => {
    expect(buyerLogin).not.toContain('type="password"');
    expect(buyerLogin).not.toContain("signInWithPassword");
    expect(buyerLogin).not.toContain("signInWithOtp");
    expect(buyerLogin).not.toContain("emailRedirectTo");
    expect(buyerLogin).not.toContain("b2b.oasisbaklawa.com");
    expect(buyerLogin).toContain("No portal or magic-link redirect is used.");
  });

  it("bridges verified email to the canonical approved Buyer instead of creating an arbitrary email login", () => {
    expect(buyerLogin).toContain('"msg91-email-session"');
    expect(emailBridgeSource).toContain("verifyAccessToken");
    expect(emailBridgeSource).toContain("extractProviderVerifiedEmail");
    expect(emailBridgeSource).toContain('.eq("status", "approved")');
    expect(emailBridgeSource).toContain('.ilike("contact_email", email)');
    expect(emailBridgeSource).toContain("boundIds");
    expect(emailBridgeSource).toContain("auth.admin.getUserById");
    expect(emailBridgeSource).toContain("approved_b2b_pending_claim");
  });

  it("mints sessions by token hash only after provider verification", () => {
    expect(buyerLogin).toContain("token_hash: verifyRes.token_hash");
    expect(buyerLogin).toContain('type: "email"');
    expect(buyerLogin).toContain("runApprovedClaim");
    expect(buyerLogin).toContain('requiredMembership: "buyer"');
  });
});

describe("Admin routing remains role-derived", () => {
  it("contains no hard-coded privileged identity redirect", () => {
    for (const source of [appSource, authFlowSource, buyerLogin, staffLogin, authEntry]) {
      expect(source).not.toContain("admin@oasisbaklawa.com");
      expect(source).not.toContain("9891162212");
      expect(source).not.toContain("isAdminExpress");
    }
  });
});
