import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const source = readFileSync("supabase/functions/whatsapp-otp/index.ts", "utf8");
const config = readFileSync("supabase/config.toml", "utf8");

describe("WA-100 P0 — historical WhatsApp OTP endpoint retirement", () => {
  it("returns a fail-closed 410 instead of generating a login session", () => {
    expect(source).toContain('LEGACY_WHATSAPP_OTP_RETIRED');
    expect(source).toContain("status: 410");
    expect(source).toContain('"Cache-Control": "no-store"');
    expect(source).not.toContain("Access-Control-Allow-Origin");
  });

  it("cannot issue OTPs, fetch secrets or create accounts", () => {
    expect(source).not.toMatch(/CLICK2API_|MSG91_|SUPABASE_SERVICE_ROLE_KEY/);
    expect(source).not.toMatch(/Math\.random|generateOTP|otpStore|\.generateLink\(|\.createUser\(|\.signIn/);
    expect(source).not.toMatch(/\.from\(|\.insert\(|\.upsert\(|\.delete\(|fetch\(/);
    expect(source).not.toContain("app_settings");
  });

  it("requires a JWT even though all authorized requests receive 410", () => {
    expect(config).toMatch(/\[functions\.whatsapp-otp\]\s*verify_jwt\s*=\s*true/);
  });

  it("does not change the active MSG91 OTP route configuration", () => {
    expect(config).toMatch(/\[functions\.msg91-otp\]\s*verify_jwt\s*=\s*false/);
  });
});
