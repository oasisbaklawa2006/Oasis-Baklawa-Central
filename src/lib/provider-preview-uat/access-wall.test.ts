import { describe, expect, it } from "vitest";
import {
  DEPLOYMENT_PROTECTION_CLASS,
  classifyAccessWallFromSignals,
  classifyBlockedNavigationUrl,
} from "./access-wall";

describe("provider-preview access wall classification", () => {
  it("treats a Vercel login URL as deployment protection even when app markers are present", () => {
    const result = classifyAccessWallFromSignals(
      "Oasis Trace",
      "https://vercel.com/login",
      "Oasis Trace deployment",
    );
    expect(result.blocked).toBe(true);
    expect(result.classification).toBe(DEPLOYMENT_PROTECTION_CLASS);
  });

  it("classifies rejected Vercel login and SSO redirects as deployment protection", () => {
    expect(classifyBlockedNavigationUrl("https://vercel.com/login?next=%2Ffoo")).toBe(
      DEPLOYMENT_PROTECTION_CLASS,
    );
    expect(classifyBlockedNavigationUrl("https://vercel.com/sso?next=%2Ffoo")).toBe(
      DEPLOYMENT_PROTECTION_CLASS,
    );
  });

  it("keeps other rejected hosts as generic governed redirect blocks", () => {
    expect(classifyBlockedNavigationUrl("https://example.com/redirect")).toBe(
      "NAVIGATION_REDIRECT_BLOCKED",
    );
  });
});
