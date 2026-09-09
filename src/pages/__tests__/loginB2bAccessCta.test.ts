import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";

// Issue #561 — physical UAT defect.
// The login footer CTA "Apply for B2B Access" navigated to /register, a route
// that does not exist in App.tsx, so every prospective buyer hit a 404. The CTA
// must instead run the governed mobile-verification identity gate
// (launchMsg91Widget), which is the only sanctioned onboarding entry point.
// No anonymous application write and no new registration route are permitted.
// Codacy-safe: literal repo-root-relative path (tests run from repo root).
const source = readFileSync("src/pages/Login.tsx", "utf8");

const ctaHandlerName = "handleApplyForB2BAccess";

describe("Login / Apply for B2B Access CTA", () => {
  it("never navigates to the nonexistent /register route", () => {
    expect(source).not.toContain('"/register"');
    expect(source).not.toContain("'/register'");
  });

  it("binds the CTA to a dedicated handler rather than an inline navigate", () => {
    expect(source).toContain(`onClick={${ctaHandlerName}}`);
    expect(source).toContain("Apply for B2B Access");
    expect(source).toContain(`const ${ctaHandlerName} = `);
  });

  it("routes that handler through the existing mobile-verification gate", () => {
    const handler = source.slice(source.indexOf(`const ${ctaHandlerName} = `));
    const body = handler.slice(0, handler.indexOf("};") + 2);
    expect(body).toContain('setActiveTab("msg91")');
    expect(body).toContain("launchMsg91Widget()");
  });

  it("does not introduce an anonymous B2B application write from the login page", () => {
    expect(source).not.toContain("submit_b2b_trade_application_v1");
  });
});