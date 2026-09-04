import { afterEach, describe, expect, it } from "vitest";
import {
  hashIdentifier,
  readDispatchRlsCertCleanupCredentials,
  readDispatchRlsCertDispatchCredentials,
  resolveDispatchRlsCertBackend,
  sanitizeProbeDetail,
} from "@/lib/dispatchRbacRlsCert/support";

describe("dispatch-rbac-rls-support", () => {
  const envSnapshot = { ...process.env };

  afterEach(() => {
    process.env = { ...envSnapshot };
  });

  it("hashes identifiers without exposing raw values", () => {
    const hash = hashIdentifier("550e8400-e29b-41d4-a716-446655440000");
    expect(hash).toHaveLength(12);
    expect(hash).not.toContain("550e8400");
  });

  it("prefers TEST_DISPATCH credentials over factory cert naming", () => {
    process.env.TEST_DISPATCH_EMAIL = "dispatch@example.test";
    process.env.TEST_DISPATCH_PASSWORD = "dispatch-secret";
    process.env.FACTORY_CERT_DISPATCH_MANAGER_EMAIL = "factory@example.test";
    process.env.FACTORY_CERT_DISPATCH_MANAGER_PASSWORD = "factory-secret";
    expect(readDispatchRlsCertDispatchCredentials()).toEqual({
      email: "dispatch@example.test",
      password: "dispatch-secret",
    });
  });

  it("prefers TEST_ADMIN cleanup credentials over factory cert naming", () => {
    process.env.TEST_ADMIN_EMAIL = "admin@example.test";
    process.env.TEST_ADMIN_PASSWORD = "admin-secret";
    process.env.FACTORY_CERT_SUPER_ADMIN_EMAIL = "super@example.test";
    process.env.FACTORY_CERT_SUPER_ADMIN_PASSWORD = "super-secret";
    expect(readDispatchRlsCertCleanupCredentials()).toEqual({
      email: "admin@example.test",
      password: "admin-secret",
    });
  });

  it("falls back to production public client constants when factory backend is absent", () => {
    delete process.env.FACTORY_CERT_SUPABASE_URL;
    delete process.env.FACTORY_CERT_SUPABASE_ANON_KEY;
    expect(resolveDispatchRlsCertBackend()).toEqual({
      url: "https://tcxvcatsqqertcnycuop.supabase.co",
      anonKey: "sb_publishable_UbNV2X25YHY3cupjpoLsjw_RhlDG4f_",
    });
  });

  it("sanitizes probe detail for publication", () => {
    expect(sanitizeProbeDetail("insert succeeded")).toBe("insert_succeeded");
    expect(sanitizeProbeDetail("permission denied for table finance_review_evidence")).toBe(
      "permission_denied",
    );
  });
});
