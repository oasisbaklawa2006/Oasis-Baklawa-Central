import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";

const buyerLogin = readFileSync("src/pages/BuyerLogin.tsx", "utf8");

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
    expect(buyerLogin).toContain("supabase.auth.verifyOtp");
    expect(buyerLogin).toContain('type: "email"');
    expect(buyerLogin).toContain("SESSION_CREATE_STARTED");
    expect(buyerLogin).toContain("mintEmailPresent");
    expect(buyerLogin).toContain('requiredMembership: "buyer"');
  });

  it("verifies the minted session with token_hash only (no client-supplied email)", () => {
    const block = buyerLogin.slice(
      buyerLogin.indexOf("const verifiedMobileSession"),
      buyerLogin.indexOf("const sendMobileOtp"),
    );
    const verifyOtpCall = block.slice(block.indexOf("supabase.auth.verifyOtp"));
    expect(verifyOtpCall).toContain("token_hash: verifyRes.token_hash");
    expect(verifyOtpCall).not.toContain("email:");
    expect(buyerLogin).not.toContain("internalPhoneEmailFromIdentifier");
  });

  it("runs approved B2B claim after SESSION_CREATE_SUCCESS and before redirectAfterAuth", () => {
    const block = buyerLogin.slice(
      buyerLogin.indexOf("const verifiedMobileSession"),
      buyerLogin.indexOf("const sendMobileOtp"),
    );
    const sessionIdx = block.indexOf("SESSION_CREATE_SUCCESS");
    const claimIdx = block.indexOf("APPROVED_B2B_CLAIM_STARTED");
    const redirectIdx = block.indexOf("runRedirectAfterAuth");
    expect(sessionIdx).toBeGreaterThan(-1);
    expect(claimIdx).toBeGreaterThan(sessionIdx);
    expect(redirectIdx).toBeGreaterThan(claimIdx);
    expect(block).toContain("claimApprovedB2bIdentityForAuthenticatedSession");
    expect(block).toContain("invokeApprovedB2bIdentityClaimRpc");
    expect(block).toContain("assertApprovedB2bClaimBound");
    expect(block).toContain("approved_b2b_pending_claim");
  });

  it("renders an explicit OTP entry and verification action", () => {
    expect(buyerLogin).toContain('id="buyer-mobile-otp"');
    expect(buyerLogin).toContain('autoComplete="one-time-code"');
    expect(buyerLogin).toContain("Verify and continue");
    expect(buyerLogin).toContain("Resend mobile OTP");
  });

  it("preserves leading-zero OTPs and never coerces them to a number", () => {
    expect(buyerLogin).toContain("window.verifyOtp(\n        otp,");
    expect(buyerLogin).not.toContain("Number(otp)");
  });

  it("bounds provider and Edge calls and cancels stale attempts", () => {
    expect(buyerLogin).toContain("MSG91_PROVIDER_CALL_TIMEOUT_MS");
    expect(buyerLogin).toContain("MSG91_EDGE_TIMEOUT_MS");
    expect(buyerLogin).toContain("createAbortController()");
    expect(buyerLogin).toContain("signal: abortController.signal");
    expect(buyerLogin).toContain("registerTimer(window.setTimeout");
    expect(buyerLogin).toContain("attemptRef.current = null");
  });

  it("allows ~20s for MSG91 SDK load and custom-method readiness on slow mobile browsers", () => {
    const readinessPollMatches = buyerLogin.match(/attempts >= 160/g) ?? [];
    expect(readinessPollMatches.length).toBeGreaterThanOrEqual(2);
    expect(buyerLogin).not.toContain("attempts >= 40");
  });

  it("announces dynamic OTP status and maps post-mint failures through buyer-login-errors", () => {
    expect(buyerLogin).toContain('aria-live="polite"');
    expect(buyerLogin).toContain("mapBuyerPostMintAuthError");
    expect(buyerLogin).toContain("postMintStage");
    expect(buyerLogin).toContain("APPROVED_B2B_CLAIM_FAILED");
    expect(buyerLogin).toContain("session_token_missing");
  });
});
