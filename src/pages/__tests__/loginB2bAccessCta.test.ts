import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";

const source = readFileSync("src/pages/Login.tsx", "utf8");
const ctaHandlerName = "handleApplyForB2BAccess";

describe("Login / Apply for B2B Access CTA", () => {
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
