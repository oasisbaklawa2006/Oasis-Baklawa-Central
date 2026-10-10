import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";

const buyerLogin = readFileSync("src/pages/BuyerLogin.tsx", "utf8");
const gateway = readFileSync("supabase/functions/buyer-login-gateway/index.ts", "utf8");
const emailBridge = readFileSync("supabase/functions/msg91-email-session/index.ts", "utf8");

describe("Buyer MSG91 dual-channel OTP regression", () => {
  it("uses exposed MSG91 methods with an explicit captcha mount", () => {
    expect(buyerLogin).toContain("exposeMethods: true");
    expect(buyerLogin).toContain("window.sendOtp");
    expect(buyerLogin).toContain("window.verifyOtp");
    expect(buyerLogin).toContain("window.retryOtp");
    expect(buyerLogin).toContain("captchaRenderId: MSG91_CAPTCHA_ID");
    expect(buyerLogin).toContain('id={MSG91_CAPTCHA_ID}');
  });

  it("bounds and can fully reinitialize a lazy or hung security check", () => {
    expect(buyerLogin).toContain("MSG91_SDK_POLL_ATTEMPTS");
    expect(buyerLogin).toContain("MSG91_PROVIDER_CALL_TIMEOUT_MS");
    expect(buyerLogin).toContain("resetMsg91Provider");
    expect(buyerLogin).toContain("await loadMsg91Script(true)");
    expect(buyerLogin).toContain("Retry security check");
    expect(buyerLogin).toContain("securityRetryNonce");
  });

  it("checks canonical Buyer eligibility before either channel can call sendOtp", () => {
    const requestBlock = buyerLogin.slice(
      buyerLogin.indexOf("const requestProviderOtp"),
      buyerLogin.indexOf("const sendMobileOtp"),
    );
    expect(requestBlock).toContain("invokePreflight(targetChannel, identifier, attemptId)");
    expect(requestBlock.indexOf("invokePreflight")).toBeLessThan(requestBlock.indexOf("window.sendOtp"));
    expect(gateway).toContain("Employees must use Admin Login");
    expect(gateway).toContain('result("pending"');
    expect(gateway).toContain('result("unknown"');
  });

  it("uses MSG91 for both mobile and email OTP requests", () => {
    expect(buyerLogin).toContain('requestProviderOtp(`91${phone.last10}`, "mobile", "mobile_otp"');
    expect(buyerLogin).toContain('requestProviderOtp(trimmedEmail, "email", "email_otp"');
    expect(buyerLogin).toContain("setMobileReqId");
    expect(buyerLogin).toContain("setEmailReqId");
  });

  it("keeps mobile and email provider verification server-authoritative", () => {
    expect(buyerLogin).toContain('type SessionBridge = "msg91-otp" | "msg91-email-session"');
    expect(buyerLogin).toContain('bridge === "msg91-otp"');
    expect(buyerLogin).toContain('bridge === "msg91-email-session"');
    expect(buyerLogin).toContain("extractEdgeFunctionErrorCode");
    expect(emailBridge).toContain("verifyAccessToken");
    expect(emailBridge).toContain("extractProviderVerifiedEmail");
    expect(emailBridge).toContain("email_verification_mismatch");
  });

  it("uses token-hash-only Supabase session exchange for both channels", () => {
    const block = buyerLogin.slice(
      buyerLogin.indexOf("const verifiedProviderSession"),
      buyerLogin.indexOf("const requestProviderOtp"),
    );
    expect(block).toContain("token_hash: verifyRes.token_hash");
    expect(block).toContain('type: "email"');
    const verifyCall = block.slice(block.indexOf("supabase.auth.verifyOtp"), block.indexOf("if (sessionError"));
    expect(verifyCall).not.toContain("email:");
  });

  it("resolves verified email against approved B2B authority before minting", () => {
    expect(emailBridge).toContain('.from("b2b_applications")');
    expect(emailBridge).toContain('.eq("status", "approved")');
    expect(emailBridge).toContain('.ilike("contact_email", email)');
    expect(emailBridge).toContain("boundIds");
    expect(emailBridge).toContain("auth.admin.getUserById");
    expect(emailBridge).toContain("ambiguous_email_identity");
  });

  it("runs the governed B2B claim before Buyer redirect", () => {
    const block = buyerLogin.slice(
      buyerLogin.indexOf("const verifiedProviderSession"),
      buyerLogin.indexOf("const requestProviderOtp"),
    );
    expect(block).toContain("runApprovedClaim");
    expect(block.indexOf("runApprovedClaim")).toBeLessThan(block.indexOf("runRedirectAfterAuth"));
    expect(buyerLogin).toContain('requiredMembership: "buyer"');
  });

  it("preserves leading-zero OTPs and does not coerce them to numbers", () => {
    expect(buyerLogin).toContain("window.verifyOtp(\n        otp,");
    expect(buyerLogin).not.toContain("Number(otp)");
  });

  it("distinguishes a true Edge timeout from normal cleanup", () => {
    expect(buyerLogin).toContain("MSG91_EDGE_TIMEOUT_MS");
    expect(buyerLogin).toContain("edgeTimedOut = true");
    expect(buyerLogin).toContain("signal: abortController.signal");
    expect(buyerLogin).toContain('edgeTimedOut ? "session_token_mint_timeout"');
  });

  it("does not overclaim delivery when MSG91 only acknowledges the request", () => {
    expect(buyerLogin).toContain("OTP request accepted by MSG91");
    expect(buyerLogin).toContain("Email OTP request accepted by MSG91");
    expect(buyerLogin).not.toContain("OTP sent to your registered mobile number.");
  });

  it("keeps email on Central with no magic-link navigation", () => {
    expect(buyerLogin).toContain("No portal or magic-link redirect is used.");
    expect(buyerLogin).not.toContain("emailRedirectTo");
    expect(buyerLogin).not.toContain("b2b.oasisbaklawa.com");
    expect(buyerLogin).not.toContain("signInWithOtp");
  });

  it("renders OTP inputs and recovery actions for both channels", () => {
    expect(buyerLogin).toContain('id="buyer-mobile-otp"');
    expect(buyerLogin).toContain('id="buyer-email-otp"');
    expect(buyerLogin).toContain('autoComplete="one-time-code"');
    expect(buyerLogin).toContain("Resend mobile OTP");
    expect(buyerLogin).toContain("Resend email OTP");
    expect(buyerLogin).toContain('aria-live="polite"');
  });
});
