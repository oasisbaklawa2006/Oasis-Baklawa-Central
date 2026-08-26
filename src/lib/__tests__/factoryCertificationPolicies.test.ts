import { describe, expect, it } from "vitest";
import {
  factoryCertificationCredentialSpec,
  factoryCertificationCredentialSpecs,
  findDuplicateCertificationEmails,
} from "../factoryCertificationCredentialPolicy";
import {
  validateFactoryCertificationBackend,
  validateFactoryCertificationTarget,
} from "../factoryCertificationEnvironmentPolicy";

describe("Factory certification credential policy", () => {
  it("derives one explicit environment-variable pair per canonical role", () => {
    expect(factoryCertificationCredentialSpec("prod_arabic_sweets")).toEqual({
      role: "PROD_ARABIC_SWEETS",
      emailEnv: "FACTORY_CERT_PROD_ARABIC_SWEETS_EMAIL",
      passwordEnv: "FACTORY_CERT_PROD_ARABIC_SWEETS_PASSWORD",
    });
  });

  it("deduplicates role specs without collapsing different roles", () => {
    const specs = factoryCertificationCredentialSpecs(["ADMIN", "RGS_ADMIN", "ADMIN"]);
    expect(specs.map((spec) => spec.role)).toEqual(["ADMIN", "RGS_ADMIN"]);
  });

  it("rejects invalid role keys", () => {
    expect(() => factoryCertificationCredentialSpec("admin role")).toThrow(/Invalid Factory certification role key/);
  });

  it("detects one email reused across multiple role identities", () => {
    expect(
      findDuplicateCertificationEmails([
        { role: "PRODUCTION_MANAGER", email: "same@example.test" },
        { role: "RGS_ADMIN", email: "same@example.test" },
        { role: "ADMIN", email: "admin@example.test" },
      ]),
    ).toEqual([{ email: "same@example.test", roles: ["PRODUCTION_MANAGER", "RGS_ADMIN"] }]);
  });
});

describe("Factory certification environment policy", () => {
  it("allows localhost by default", () => {
    expect(validateFactoryCertificationTarget({ targetUrl: "http://127.0.0.1:4173/" })).toEqual({
      valid: true,
      normalizedUrl: "http://127.0.0.1:4173",
    });
  });

  it("rejects production and Vercel preview hosts", () => {
    expect(validateFactoryCertificationTarget({ targetUrl: "https://b2b.oasisbaklawa.com" }).valid).toBe(false);
    expect(validateFactoryCertificationTarget({ targetUrl: "https://some-branch.vercel.app" }).valid).toBe(false);
  });

  it("requires an exact host and environment id for an explicitly remote disposable target", () => {
    expect(
      validateFactoryCertificationTarget({
        targetUrl: "https://cert.example.test",
        allowRemoteEphemeral: true,
        allowedHost: "cert.example.test",
        environmentId: "factory-cert-123",
      }).valid,
    ).toBe(true);

    expect(
      validateFactoryCertificationTarget({
        targetUrl: "https://wrong.example.test",
        allowRemoteEphemeral: true,
        allowedHost: "cert.example.test",
        environmentId: "factory-cert-123",
      }).valid,
    ).toBe(false);
  });

  it("applies the same fail-closed rule to the Supabase backend", () => {
    expect(validateFactoryCertificationBackend({ supabaseUrl: "http://127.0.0.1:54321" }).valid).toBe(true);
    expect(validateFactoryCertificationBackend({ supabaseUrl: "https://project.supabase.co" }).valid).toBe(false);
    expect(
      validateFactoryCertificationBackend({
        supabaseUrl: "https://factory-cert.supabase.co",
        allowRemoteEphemeral: true,
        allowedSupabaseHost: "factory-cert.supabase.co",
        environmentId: "factory-cert-123",
      }).valid,
    ).toBe(true);
  });
});
