import { describe, expect, it } from "vitest";
import { AuthFlowError } from "@/lib/auth-flow";
import { mapBuyerOtpProviderError, mapBuyerPostMintAuthError } from "@/lib/buyer-login-errors";

describe("buyer-login-errors / provider OTP mapping", () => {
  it("maps provider verification failures without exposing raw RPC text", () => {
    expect(mapBuyerOtpProviderError("provider_verification_failed")).toContain("MSG91 could not verify");
    expect(mapBuyerOtpProviderError("duplicate_phone_identity")).toContain("more than one account");
  });
});

describe("buyer-login-errors / post-mint failure surfacing", () => {
  it("surfaces approved B2B claim failures instead of the generic mobile verification copy", () => {
    const mapped = mapBuyerPostMintAuthError(new Error("APPROVED_B2B_IDENTITY_CLAIM_FAILED:rpc_error"));
    expect(mapped.stage).toBe("approved_b2b_claim");
    expect(mapped.message).toContain("approved B2B account could not be linked");
    expect(mapped.message).not.toBe("Mobile verification failed. Please try again.");
  });

  it("surfaces ambiguous approved-application claim conflicts for ops", () => {
    const mapped = mapBuyerPostMintAuthError(new Error("APPROVED_B2B_IDENTITY_CLAIM_FAILED:ambiguous"));
    expect(mapped.stage).toBe("approved_b2b_claim");
    expect(mapped.message).toContain("More than one approved B2B application");
  });

  it("maps session token exchange failures after Edge mint", () => {
    const mapped = mapBuyerPostMintAuthError(new Error("Email link is invalid or has expired"));
    expect(mapped.stage).toBe("session_token");
    expect(mapped.message).toContain("expired");
  });

  it("preserves AuthFlowError buyer membership messaging", () => {
    const mapped = mapBuyerPostMintAuthError(
      new AuthFlowError("BUYER_MEMBERSHIP_REQUIRED", "internal", "failed"),
    );
    expect(mapped.stage).toBe("buyer_membership");
    expect(mapped.message).toContain("B2B buyers only");
  });
});
