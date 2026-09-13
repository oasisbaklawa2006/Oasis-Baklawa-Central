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
    expect(buyerLogin).toContain('requiredMembership: "buyer"');
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

  it("announces dynamic OTP status and maps session-token failures", () => {
    expect(buyerLogin).toContain('aria-live="polite"');
    expect(buyerLogin).toContain("session_token_mint_failed");
    expect(buyerLogin).toContain("session_token_missing");
  });
});
