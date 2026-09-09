import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";

const source = readFileSync("supabase/functions/msg91-otp/index.ts", "utf8");

describe("msg91-otp / scalable fail-closed identity resolution", () => {
  it("does not enumerate the Auth or public users directories", () => {
    expect(source).not.toContain(".listUsers(");
    expect(source).not.toContain("IDENTITY_SCAN_CEILING");
    expect(source).not.toContain("IDENTITY_PAGE_SIZE");
    expect(source).not.toContain(".range(from, to)");
  });

  it("uses targeted canonical phone variants and the canonical public user id", () => {
    expect(source).toContain("function phoneVariants");
    expect(source).toContain('.in("phone", variants)');
    expect(source).toContain('.in("mobile_number", variants)');
    expect(source).toContain('.overlaps("secondary_phones", variants)');
    expect(source).toContain("auth.admin.getUserById(publicId)");
  });

  it("keeps duplicate and lookup failures fail-closed", () => {
    expect(source).toContain("duplicate_phone_identity");
    expect(source).toContain("identity_lookup_failed");
    expect(source).toContain("phone_already_linked_to_other_identity");
    expect(source).toContain("auth_user_create_failed");
  });
});

describe("msg91-otp / provider response privacy", () => {
  it("does not return the provider raw payload to the browser", () => {
    expect(source).toContain('error: "provider_verification_failed"');
    expect(source).not.toContain("JSON.stringify({ ok: false, type: result.raw.type ?? null, raw: result.raw })");
  });

  it("does not log customer email or phone in the success response log", () => {
    const successLog = source.slice(source.indexOf('console.log("[msg91-otp] verify_widget response"'));
    const block = successLog.slice(0, successLog.indexOf("}));") + 4);
    expect(block).toContain("user_id: authRef.userId");
    expect(block).toContain("is_new: isNew");
    expect(block).not.toContain("email: authRef.email");
    expect(block).not.toContain("phone: e164");
  });

  it("masks the client-supplied phone in request logs", () => {
    expect(source).toContain("phone: maskSecret(body.phone ?? null)");
  });
});
