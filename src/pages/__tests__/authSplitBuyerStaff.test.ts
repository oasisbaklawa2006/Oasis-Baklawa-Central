import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";

// AUTH SPLIT — B2B Client Login vs Oasis Staff Login.
// Structural contract for the three login surfaces: /login (neutral
// selector), /buyer/login (B2B buyer only) and /staff/login (Oasis staff
// only). These assertions read source directly (matching this repo's
// existing Login-contract test convention) so a future edit that
// re-introduces a mixed surface, or a hard-coded identity routing shortcut,
// fails CI immediately rather than only at review time.

const authEntry = readFileSync("src/pages/AuthEntry.tsx", "utf8");
const buyerLogin = readFileSync("src/pages/BuyerLogin.tsx", "utf8");
const staffLogin = readFileSync("src/pages/StaffLogin.tsx", "utf8");
const appSource = readFileSync("src/App.tsx", "utf8");
const authFlowSource = readFileSync("src/lib/auth-flow.ts", "utf8");

describe("Requirement 1 — /login is only an entry selector", () => {
  it("routes /login to AuthEntry, not a login form", () => {
    expect(appSource).toContain('<Route path="/login" element={<AuthEntry />} />');
  });

  it("renders exactly two destination choices plus the Apply link, no auth fields", () => {
    expect(authEntry).not.toContain('type="password"');
    expect(authEntry).not.toContain('type="email"');
    expect(authEntry).not.toContain("initSendOTP");
    expect(authEntry).not.toContain("signInWithPassword");
    expect(authEntry).toContain('navigate("/buyer/login")');
    expect(authEntry).toContain('navigate("/staff/login")');
    expect(authEntry).toContain("B2B Client Login");
    expect(authEntry).toContain("Oasis Staff Login");
    expect(authEntry).toContain("Apply for B2B Access");
  });
});

describe("Requirement 2/3 — /buyer/login is buyer-only", () => {
  it("routes /buyer/login to BuyerLogin", () => {
    expect(appSource).toContain('<Route path="/buyer/login" element={<BuyerLogin />} />');
  });

  it("renders buyer login controls (MSG91 mobile verification)", () => {
    expect(buyerLogin).toContain("initSendOTP");
    expect(buyerLogin).toContain("Secure Mobile Verification");
    expect(buyerLogin).toContain("MSG91_WIDGET_ID");
  });

  it("declares Oasis Buyer branding", () => {
    expect(buyerLogin).toContain("Oasis Buyer");
  });

  it("carries the Apply for B2B Access CTA to the public pre-login route", () => {
    expect(buyerLogin).toContain('navigate("/buyer/access-request")');
  });

  it("does not render staff email/password controls", () => {
    expect(buyerLogin).not.toContain('type="password"');
    expect(buyerLogin).not.toContain("signInWithPassword");
    expect(buyerLogin).not.toContain("resetPasswordForEmail");
  });

  it("enforces the buyer membership boundary through the shared redirect helper", () => {
    expect(buyerLogin).toContain('requiredMembership: "buyer"');
  });
});

describe("Requirement 4/5/6 — /staff/login is staff-only", () => {
  it("routes /staff/login to StaffLogin", () => {
    expect(appSource).toContain('<Route path="/staff/login" element={<StaffLogin />} />');
  });

  it("renders staff login controls (email/password)", () => {
    expect(staffLogin).toContain('showPwd ? "text" : "password"');
    expect(staffLogin).toContain("signInWithPassword");
  });

  it("declares Oasis Staff branding", () => {
    expect(staffLogin).toContain("Oasis Staff");
  });

  it("does not render Apply for B2B Access", () => {
    expect(staffLogin).not.toContain("Apply for B2B Access");
    expect(staffLogin).not.toContain('navigate("/buyer/access-request")');
  });

  it("does not initialize buyer MSG91 onboarding", () => {
    expect(staffLogin).not.toContain("initSendOTP");
    expect(staffLogin).not.toContain("ensureMsg91Provider");
    expect(staffLogin).not.toContain("MSG91_WIDGET_ID");
    expect(staffLogin).not.toContain("msg91-otp");
  });

  it("enforces the staff membership boundary through the shared redirect helper", () => {
    expect(staffLogin).toContain('requiredMembership: "staff"');
  });
});

describe("Requirement 12 — Admin/Super Admin routing is role-derived only", () => {
  it("App.tsx no longer hard-codes an admin identity redirect", () => {
    expect(appSource).not.toContain("ADMIN_EXPRESS_EMAILS");
    expect(appSource).not.toContain("ADMIN_EXPRESS_PHONES");
    expect(appSource).not.toContain("isAdminExpressUser");
    expect(appSource).not.toContain("admin@oasisbaklawa.com");
    expect(appSource).not.toContain("9891162212");
  });

  it("the shared redirect helper carries no identity-based admin branch", () => {
    expect(authFlowSource).not.toContain("admin@oasisbaklawa.com");
    expect(authFlowSource).not.toContain("9891162212");
    expect(authFlowSource).not.toContain("isAdminExpress");
  });

  it("neither login surface hard-codes an admin identity redirect", () => {
    for (const source of [buyerLogin, staffLogin, authEntry]) {
      expect(source).not.toContain("admin@oasisbaklawa.com");
      expect(source).not.toContain("9891162212");
      expect(source).not.toContain("isAdminExpress");
    }
  });

  it("redirectAfterAuth navigates only to the role-derived destination", () => {
    const start = authFlowSource.indexOf("export async function redirectAfterAuth");
    const body = authFlowSource.slice(start, authFlowSource.indexOf("\n}", authFlowSource.lastIndexOf("params.navigate(result.destination")));
    expect(body).toContain("params.navigate(result.destination");
    expect(body).not.toContain('"/admin/cmd-war-room"');
  });
});

describe("MSG91 client-side configuration classification", () => {
  // MSG91_WIDGET_ID / MSG91_TOKEN_AUTH are the browser Widget SDK's public
  // init pair (see initSendOTP() call sites) -- MSG91's own client-widget
  // model, analogous to a reCAPTCHA site key. The provider secret used to
  // call MSG91's REST send APIs is a distinct value (MSG91_AUTH_KEY) that
  // must only ever live in an Edge Function's server-side environment.
  it("BuyerLogin documents the widget-config vs provider-secret boundary", () => {
    expect(buyerLogin).toContain("MSG91_WIDGET_ID");
    expect(buyerLogin).toContain("MSG91_TOKEN_AUTH");
    expect(buyerLogin).toContain("not the MSG91 account authkey");
  });

  it("no login surface embeds an MSG91 server-side authkey variable name", () => {
    for (const source of [buyerLogin, staffLogin, authEntry]) {
      expect(source).not.toContain("MSG91_AUTH_KEY");
    }
  });
});
