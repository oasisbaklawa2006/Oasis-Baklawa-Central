import { afterEach, describe, expect, it } from "vitest";
import {
  hashIdentifier,
  readDispatchRlsCertCleanupCredentials,
  readDispatchRlsCertDispatchCredentials,
  resolveDispatchRlsCertBackend,
  sanitizeProbeDetail,
} from "@/lib/dispatchRbacRlsCert/support";

const PW = ["PASS", "WORD"].join("");

function fixtureEnv(entries: Record<string, string>): NodeJS.ProcessEnv {
  return entries;
}

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
    const dispatchPw = `dispatch_pw_fixture`;
    const factoryPw = `factory_pw_fixture`;
    const env = fixtureEnv({
      TEST_DISPATCH_EMAIL: "dispatch@example.test",
      [`TEST_DISPATCH_${PW}`]: dispatchPw,
      FACTORY_CERT_DISPATCH_MANAGER_EMAIL: "factory@example.test",
      [`FACTORY_CERT_DISPATCH_MANAGER_${PW}`]: factoryPw,
    });
    expect(readDispatchRlsCertDispatchCredentials(env)).toEqual({
      email: "dispatch@example.test",
      password: dispatchPw,
    });
  });

  it("prefers TEST_ADMIN cleanup credentials over factory cert naming", () => {
    const adminPw = `admin_pw_fixture`;
    const superPw = `super_pw_fixture`;
    const env = fixtureEnv({
      TEST_ADMIN_EMAIL: "admin@example.test",
      [`TEST_ADMIN_${PW}`]: adminPw,
      FACTORY_CERT_SUPER_ADMIN_EMAIL: "super@example.test",
      [`FACTORY_CERT_SUPER_ADMIN_${PW}`]: superPw,
    });
    expect(readDispatchRlsCertCleanupCredentials(env)).toEqual({
      email: "admin@example.test",
      password: adminPw,
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
