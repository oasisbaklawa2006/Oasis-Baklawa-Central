import { describe, expect, it } from "vitest";
import {
  isLegacyB2bPortalAuthRedirect,
  resolveBuyerEmailOtpRedirectUrl,
} from "@/lib/auth-redirect-urls";

describe("auth-redirect-urls", () => {
  it("resolves Buyer email OTP / magic-link confirm to the Central buyer login surface", () => {
    expect(resolveBuyerEmailOtpRedirectUrl("https://oasis-baklawa-central.vercel.app")).toBe(
      "https://oasis-baklawa-central.vercel.app/buyer/login?manual_auth=true",
    );
    expect(resolveBuyerEmailOtpRedirectUrl("https://oasisbaklawa.com")).toBe(
      "https://oasisbaklawa.com/buyer/login?manual_auth=true",
    );
  });

  it("never targets the legacy B2B portal host", () => {
    const redirect = resolveBuyerEmailOtpRedirectUrl("https://oasis-baklawa-central.vercel.app");
    expect(redirect).not.toContain("b2b.oasisbaklawa.com");
    expect(isLegacyB2bPortalAuthRedirect(redirect)).toBe(false);
    expect(isLegacyB2bPortalAuthRedirect("https://b2b.oasisbaklawa.com/welcome")).toBe(true);
  });
});
