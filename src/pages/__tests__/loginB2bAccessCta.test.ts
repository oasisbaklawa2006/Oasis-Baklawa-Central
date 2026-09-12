import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";

const ctaHandlerName = "handleApplyForB2BAccess";

// AUTH SPLIT — B2B Client Login vs Oasis Staff Login. The combined Login.tsx
// has been split into AuthEntry.tsx (/login, neutral selector) and
// BuyerLogin.tsx (/buyer/login, B2B authentication). The Apply for B2B
// Access CTA is required on both per the auth-split spec.
describe.each([
  ["AuthEntry", "src/pages/AuthEntry.tsx"],
  ["BuyerLogin", "src/pages/BuyerLogin.tsx"],
])("%s / Apply for B2B Access CTA", (_name, path) => {
  const source = readFileSync(path, "utf8");

  it("never navigates to the deleted /register route", () => {
    expect(source).not.toContain('"/register"');
    expect(source).not.toContain("'/register'");
  });

  it("binds the CTA to the dedicated handler", () => {
    expect(source).toContain(`onClick={${ctaHandlerName}}`);
    expect(source).toContain("Apply for B2B Access");
  });

  it("opens the governed pre-login B2B application directly without forcing OTP", () => {
    const handler = source.slice(source.indexOf(`const ${ctaHandlerName} = `));
    const body = handler.slice(0, handler.indexOf("};") + 2);
    expect(body).toContain('navigate("/buyer/access-request")');
    expect(body).not.toContain('setActiveTab("msg91")');
    expect(body).not.toContain("launchMsg91Widget()");
  });
});
