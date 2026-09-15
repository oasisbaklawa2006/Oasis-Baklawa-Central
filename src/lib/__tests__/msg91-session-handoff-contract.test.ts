import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";

const source = readFileSync("supabase/functions/msg91-otp/index.ts", "utf8");
const buyerLogin = readFileSync("src/pages/BuyerLogin.tsx", "utf8");

type GuardInput = {
  ids: string[];
  unboundCompanyMemberIds: string[];
  approvedB2bPendingClaim: boolean;
};

type GuardOutcome = "mintable" | "duplicate_phone_identity" | "ambiguous_phone_identity";

/**
 * Execute the exact fail-closed identity guard shipped by msg91-otp rather than
 * merely asserting that expected strings exist. This deliberately extracts only
 * the side-effect-free guard between public identity resolution and auth minting;
 * `fail` is replaced with a deterministic return value while console output is
 * suppressed. If the handler guard changes semantically these cases fail.
 */
function executeShippedIdentityGuard(publicMatches: GuardInput): GuardOutcome {
  const start = source.indexOf("if (publicMatches.ids.length > 1)");
  const end = source.indexOf("let authRef: AuthUserRef", start);
  expect(start).toBeGreaterThan(-1);
  expect(end).toBeGreaterThan(start);

  const guard = source.slice(start, end);
  const runnable = new Function(
    "publicMatches",
    "fail",
    "console",
    `${guard}\nreturn "mintable";`,
  ) as (
    input: GuardInput,
    fail: (error: string) => GuardOutcome,
    consoleStub: { error: () => void },
  ) => GuardOutcome;

  return runnable(
    publicMatches,
    (error) => error as GuardOutcome,
    { error: () => undefined },
  );
}

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
    expect(source).toContain("approved_b2b_pending_claim");
  });

  it("only adds approved B2B user_id to mint ids when that user has explicit phone binding", () => {
    expect(source).toContain("async function phoneBoundUserIdsAmong");
    expect(source).toContain("const b2bUserIds = new Set<string>()");
    expect(source).toContain("phoneBoundB2b = await phoneBoundUserIdsAmong");
    expect(source).toContain("phoneBoundB2b.size < b2bUserIds.size");
    expect(source).not.toMatch(/if \(app\?\.user_id\) ids\.add\(String\(app\.user_id\)\)/);
  });

  it("executes approved pending-claim + unbound-company path as mintable", () => {
    expect(executeShippedIdentityGuard({
      ids: [],
      unboundCompanyMemberIds: ["unbound-company-member"],
      approvedB2bPendingClaim: true,
    })).toBe("mintable");
  });

  it("executes unbound-company-without-approved-claim path as ambiguous", () => {
    expect(executeShippedIdentityGuard({
      ids: [],
      unboundCompanyMemberIds: ["unbound-company-member"],
      approvedB2bPendingClaim: false,
    })).toBe("ambiguous_phone_identity");
  });

  it("executes multiple explicit phone bindings as duplicate identity", () => {
    expect(executeShippedIdentityGuard({
      ids: ["phone-user-a", "phone-user-b"],
      unboundCompanyMemberIds: [],
      approvedB2bPendingClaim: false,
    })).toBe("duplicate_phone_identity");
  });

  it("reads MSG91_AUTH_KEY from environment only and fails closed when unset", () => {
    expect(source).toContain('(Deno.env.get("MSG91_AUTH_KEY") || "").trim()');
    expect(source).toContain("Missing configuration fails closed; no credential fallback is embedded in source.");
    expect(source).toContain("const MSG91_ENABLED = Boolean(AUTH_KEY)");
    expect(source).not.toMatch(/MSG91_AUTH_KEY[^\n]*\|\|\s*"[A-Za-z0-9]+"/);
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

describe("BuyerLogin / MSG91 token_hash session handoff", () => {
  it("calls verifyOtp with token_hash only so mint email cannot mismatch Auth user", () => {
    const start = buyerLogin.indexOf("const verifiedProviderSession");
    const end = buyerLogin.indexOf("const requestProviderOtp", start);
    expect(start).toBeGreaterThan(-1);
    expect(end).toBeGreaterThan(start);
    const block = buyerLogin.slice(start, end);
    const verifyOtpCall = block.slice(block.indexOf("supabase.auth.verifyOtp"));
    expect(verifyOtpCall).toMatch(/verifyOtp\(\{\s*token_hash: verifyRes\.token_hash,\s*type: "email",\s*\}\)/);
    expect(verifyOtpCall).not.toContain("email:");
  });

  it("records mint email presence on SESSION_CREATE_FAILED without passing email to verifyOtp", () => {
    expect(buyerLogin).toContain("mintEmailPresent: Boolean(mintEmail)");
    expect(buyerLogin).toContain('logAuthEvent("SESSION_CREATE_FAILED"');
    expect(buyerLogin).toContain("error: sessionFailure");
  });
});
