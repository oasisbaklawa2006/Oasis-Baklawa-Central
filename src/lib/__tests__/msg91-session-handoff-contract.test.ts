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
    expect(source).toContain("phonePatternResult");
    expect(source).toContain("phone.ilike.${pattern},mobile_number.ilike.${pattern}");
    expect(source).toContain("auth.admin.getUserById(publicId)");
  });

  it("resolves approved B2B application and company phone authority before minting orphan Auth users", () => {
    expect(source).toContain('.from("b2b_applications")');
    expect(source).toContain('.eq("status", "approved")');
    expect(source).toContain("contact_phone.ilike");
    expect(source).toContain("mobile_number.ilike");
    expect(source).toContain("resolved_company_id");
    expect(source).not.toContain('select("user_id, company_id")');
    expect(source).toContain('.from("companies").select("id").ilike("phone", pattern)');
    expect(source).toContain('.in("company_id", [...companyIds])');
    expect(source).toContain("unboundCompanyMemberIds");
    expect(source).toContain("ambiguous_phone_identity");
    expect(source).toContain("approved_b2b_pending_claim");
  });

  it("allows orphan Auth mint when approved B2B pending claim exists despite unbound company members", () => {
    const guardBlock = source.slice(
      source.indexOf("if (publicMatches.ids.length > 1)"),
      source.indexOf("let authRef: AuthUserRef"),
    );
    expect(guardBlock).toContain("!publicMatches.approvedB2bPendingClaim");
    expect(guardBlock).toContain("ambiguous_phone_identity");
    expect(guardBlock).toContain("duplicate_phone_identity");
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
