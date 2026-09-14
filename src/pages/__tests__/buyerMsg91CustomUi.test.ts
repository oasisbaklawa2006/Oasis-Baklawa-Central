import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";

const buyerLogin = readFileSync("src/pages/BuyerLogin.tsx", "utf8");
const gateway = readFileSync("supabase/functions/buyer-login-gateway/index.ts", "utf8");

describe("Buyer MSG91 custom OTP UI regression", () => {
  it("uses MSG91 exposed methods instead of the hidden/default widget launcher", () => {
    expect(buyerLogin).toContain("exposeMethods: true");
    expect(buyerLogin).toContain("window.sendOtp");
    expect(buyerLogin).toContain("window.verifyOtp");
    expect(buyerLogin).toContain("window.retryOtp");
    expect(buyerLogin).not.toContain("exposeMethods: false");
  });

  it("registers MSG91 init success/failure callbacks required by otp-provider.js", () => {
    const initBlock = buyerLogin.slice(
      buyerLogin.indexOf("window.initSendOTP({"),
      buyerLogin.indexOf("providerInitializedRef.current = true"),
    );
    expect(initBlock).toContain("success:");
    expect(initBlock).toContain("failure:");
    expect(initBlock).toContain("captchaRenderId: MSG91_CAPTCHA_ID");
  });

  it("requires MSG91 captcha verification before sendOtp when the SDK exposes isCaptchaVerified", () => {
    expect(buyerLogin).toContain("isCaptchaVerified");
    expect(buyerLogin).toContain("isMsg91CaptchaRequiredAndUnverified");
    expect(buyerLogin).toContain("msg91_captcha_required");
    expect(buyerLogin).toContain("Please complete the security check above before requesting an OTP.");
  });

  it("pre-warms and can fully reinitialize a stalled security check", () => {
    expect(buyerLogin).toContain("resetMsg91Provider");
    expect(buyerLogin).toContain("Retry security check");
    expect(buyerLogin).toContain("securityRetryNonce");
    expect(buyerLogin).toContain("await loadMsg91Script(true)");
    expect(buyerLogin).toContain("MSG91_SDK_POLL_ATTEMPTS");
  });

  it("checks Buyer eligibility before requesting a mobile OTP", () => {
    const block = buyerLogin.slice(
      buyerLogin.indexOf("const sendMobileOtp"),
      buyerLogin.indexOf("const verifyMobileOtp"),
    );
    expect(block).toContain('invokePreflight("mobile"');
    expect(block.indexOf("invokePreflight")).toBeLessThan(block.indexOf("window.sendOtp"));
    expect(gateway).toContain("Employees must use Admin Login");
    expect(gateway).toContain('state: "pending"');
    expect(gateway).toContain('state: "unknown"');
  });

  it("sends a country-code-qualified identifier and retains the provider request id", () => {
    expect(buyerLogin).toContain('const identifier = `91${phone.last10}`');
    expect(buyerLogin).toContain("extractMsg91RequestId");
    expect(buyerLogin).toContain("setMobileReqId(reqId)");
    expect(buyerLogin).toContain("mobileReqId ?? undefined");
  });

  it("keeps provider verification server-authoritative before Supabase session minting", () => {
    expect(buyerLogin).toContain('supabase.functions.invoke("msg91-otp"');
    expect(buyerLogin).toContain('mode: "verify_widget"');
    expect(buyerLogin).toContain("accessToken");
    expect(buyerLogin).toContain("verifyRes?.token_hash");
    expect(buyerLogin).toContain("extractEdgeFunctionErrorCode");
    expect(buyerLogin).toContain("supabase.auth.verifyOtp");
    expect(buyerLogin).toContain('type: "email"');
    expect(buyerLogin).toContain("SESSION_CREATE_STARTED");
    expect(buyerLogin).toContain("mintEmailPresent");
    expect(buyerLogin).toContain('requiredMembership: "buyer"');
  });

  it("verifies the minted mobile session with token_hash only", () => {
    const block = buyerLogin.slice(
      buyerLogin.indexOf("const verifiedMobileSession"),
      buyerLogin.indexOf("const sendMobileOtp"),
    );
    const verifyOtpCall = block.slice(block.indexOf("supabase.auth.verifyOtp"));
    expect(verifyOtpCall).toContain("token_hash: verifyRes.token_hash");
    expect(verifyOtpCall).not.toContain("email:");
    expect(buyerLogin).not.toContain("internalPhoneEmailFromIdentifier");
  });

  it("runs the approved B2B claim before redirect for mobile and email", () => {
    expect(buyerLogin).toContain("const runApprovedClaim");
    expect(buyerLogin).toContain("claimApprovedB2bIdentityForAuthenticatedSession");
    expect(buyerLogin).toContain("invokeApprovedB2bIdentityClaimRpc");
    expect(buyerLogin).toContain("assertApprovedB2bClaimBound");
    const mobileBlock = buyerLogin.slice(
      buyerLogin.indexOf("const verifiedMobileSession"),
      buyerLogin.indexOf("const sendMobileOtp"),
    );
    expect(mobileBlock.indexOf("runApprovedClaim")).toBeLessThan(mobileBlock.indexOf("runRedirectAfterAuth"));
    const emailBlock = buyerLogin.slice(
      buyerLogin.indexOf("const verifyEmailOtp"),
      buyerLogin.indexOf("const goBackToChannelChoice"),
    );
    expect(emailBlock.indexOf("runApprovedClaim")).toBeLessThan(emailBlock.indexOf("runRedirectAfterAuth"));
  });

  it("renders explicit OTP entry and verification actions", () => {
    expect(buyerLogin).toContain('id="buyer-mobile-otp"');
    expect(buyerLogin).toContain('id="buyer-email-otp"');
    expect(buyerLogin).toContain('autoComplete="one-time-code"');
    expect(buyerLogin).toContain("Verify and continue");
    expect(buyerLogin).toContain("Resend mobile OTP");
    expect(buyerLogin).toContain("Resend email OTP");
  });

  it("preserves leading-zero mobile OTPs and never coerces them to a number", () => {
    expect(buyerLogin).toContain("window.verifyOtp(\n        otp,");
    expect(buyerLogin).not.toContain("Number(otp)");
  });

  it("bounds provider and Edge calls and distinguishes a real Edge timeout", () => {
    expect(buyerLogin).toContain("MSG91_PROVIDER_CALL_TIMEOUT_MS");
    expect(buyerLogin).toContain("MSG91_EDGE_TIMEOUT_MS");
    expect(buyerLogin).toContain("createAbortController()");
    expect(buyerLogin).toContain("signal: abortController.signal");
    expect(buyerLogin).toContain("edgeTimedOut = true");
    expect(buyerLogin).toContain("attemptRef.current = null");
  });

  it("does not overclaim physical SMS delivery from the provider callback", () => {
    expect(buyerLogin).toContain("OTP request accepted by MSG91");
    expect(buyerLogin).not.toContain("OTP sent to your registered mobile number.");
  });

  it("announces dynamic OTP status and maps post-mint failures through buyer-login-errors", () => {
    expect(buyerLogin).toContain('aria-live="polite"');
    expect(buyerLogin).toContain("mapBuyerPostMintAuthError");
    expect(buyerLogin).toContain("postMintStage");
    expect(buyerLogin).toContain("APPROVED_B2B_CLAIM_FAILED");
    expect(buyerLogin).toContain("session_token_missing");
  });
});
