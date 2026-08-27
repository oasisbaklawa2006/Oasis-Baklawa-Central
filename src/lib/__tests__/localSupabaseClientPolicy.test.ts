import { describe, expect, it } from "vitest";
import { createLocalSupabaseAdminClient } from "../../../scripts/factory-certification/local-supabase-client.mjs";

function createClient(baseUrl: string) {
  return createLocalSupabaseAdminClient({
    baseUrl,
    serviceRoleKey: "local-service-role-key",
    callerLabel: "Unit test",
  });
}

describe("local Supabase certification client policy", () => {
  it("accepts a canonical plain-HTTP loopback origin", () => {
    const { localSupabaseOrigin } = createClient("http://127.0.0.1:54321");
    expect(localSupabaseOrigin).toBe("http://127.0.0.1:54321");
  });

  it("rejects HTTPS loopback targets to keep bootstrap on plain HTTP only", () => {
    expect(() => createClient("https://127.0.0.1:54321")).toThrow(/refusing Supabase protocol https:/);
  });

  it("rejects remote Supabase hosts including production project spellings", () => {
    expect(() => createClient("http://tcxvcatsqqertcnycuop.supabase.co")).toThrow(/refusing Supabase host/);
    expect(() => createClient("http://factory-cert.supabase.co")).toThrow(/refusing Supabase host/);
  });

  it("rejects loopback URLs with embedded credentials, paths, queries, or fragments", () => {
    expect(() => createClient("http://admin:secret@127.0.0.1:54321")).toThrow(/canonical loopback Supabase origin/);
    expect(() => createClient("http://127.0.0.1:54321/rest/v1/users")).toThrow(/canonical loopback Supabase origin/);
    expect(() => createClient("http://127.0.0.1:54321?apikey=leak")).toThrow(/canonical loopback Supabase origin/);
    expect(() => createClient("http://127.0.0.1:54321#fragment")).toThrow(/canonical loopback Supabase origin/);
  });
});
