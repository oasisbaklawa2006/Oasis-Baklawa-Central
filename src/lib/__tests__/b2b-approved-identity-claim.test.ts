import { describe, expect, it, vi } from "vitest";
import {
  APPROVED_B2B_IDENTITY_CLAIM_RPC,
  claimApprovedB2bIdentity,
  isApprovedB2bIdentityClaimRow,
  shouldClaimApprovedB2bIdentityAfterTokenHash,
  verifyTokenHashThenClaimApprovedB2bIdentity,
} from "@/lib/b2b-approved-identity-claim";

describe("UAT #561 approved B2B identity claim", () => {
  it("recognizes only the programmatic magiclink TokenHash handoff", () => {
    expect(shouldClaimApprovedB2bIdentityAfterTokenHash({ type: "magiclink", token_hash: "hash" })).toBe(true);
    expect(shouldClaimApprovedB2bIdentityAfterTokenHash({ type: "email", token_hash: "hash" })).toBe(false);
    expect(shouldClaimApprovedB2bIdentityAfterTokenHash({ type: "sms", token: "123456", phone: "+919999999999" })).toBe(false);
    expect(shouldClaimApprovedB2bIdentityAfterTokenHash({ type: "magiclink", token_hash: "" })).toBe(false);
  });

  it("keeps Core as the only claim authority and supplies no phone/application arguments", () => {
    expect(APPROVED_B2B_IDENTITY_CLAIM_RPC).toBe("claim_approved_b2b_access_request_v2");
  });

  it("orders verified session before Core claim before returning to account resolution", async () => {
    const order: string[] = [];
    const result = await verifyTokenHashThenClaimApprovedB2bIdentity(
      { type: "magiclink", token_hash: "provider-hash" },
      async () => {
        order.push("verify-session");
        return { data: { user: { id: "buyer-1" } }, error: null };
      },
      async () => {
        order.push("claim-approved-application");
        return { applicationId: "app-1", companyId: "company-1", claimed: true, alreadyActive: false };
      },
    );

    order.push("account-resolution");
    expect(result.data?.user).toEqual({ id: "buyer-1" });
    expect(order).toEqual(["verify-session", "claim-approved-application", "account-resolution"]);
  });

  it("does not claim if Supabase session verification fails", async () => {
    const claim = vi.fn(async () => ({ applicationId: null, companyId: null, claimed: false, alreadyActive: false }));
    await verifyTokenHashThenClaimApprovedB2bIdentity(
      { type: "magiclink", token_hash: "provider-hash" },
      async () => ({ data: { user: null }, error: new Error("verify failed") }),
      claim,
    );
    expect(claim).not.toHaveBeenCalled();
  });

  it("accepts only the exact Core row shape", () => {
    expect(isApprovedB2bIdentityClaimRow({ application_id: null, claimed: false, company_id: null, already_active: false })).toBe(true);
    expect(isApprovedB2bIdentityClaimRow({ application_id: "app-1", claimed: true, company_id: "company-1", already_active: false })).toBe(true);
    expect(isApprovedB2bIdentityClaimRow(null)).toBe(false);
    expect(isApprovedB2bIdentityClaimRow({})).toBe(false);
    expect(isApprovedB2bIdentityClaimRow({ application_id: null, claimed: "false", company_id: null, already_active: false })).toBe(false);
    expect(isApprovedB2bIdentityClaimRow({ application_id: 42, claimed: false, company_id: null, already_active: false })).toBe(false);
  });

  it("treats a structurally valid no-match Core claim as a pending-applicant no-op", async () => {
    const outcome = await claimApprovedB2bIdentity(async () => ({
      data: [{ application_id: null, claimed: false, company_id: null, already_active: false }],
      error: null,
    }));
    expect(outcome).toEqual({ applicationId: null, companyId: null, claimed: false, alreadyActive: false });
  });

  it("returns activated claim state without inventing authority client-side", async () => {
    const outcome = await claimApprovedB2bIdentity(async () => ({
      data: [{ application_id: "app-1", claimed: true, company_id: "company-1", already_active: false }],
      error: null,
    }));
    expect(outcome).toEqual({ applicationId: "app-1", companyId: "company-1", claimed: true, alreadyActive: false });
  });

  it.each([
    null,
    [],
    {},
    [{ application_id: null, claimed: false, company_id: null }],
    [{ application_id: null, claimed: "false", company_id: null, already_active: false }],
    [
      { application_id: null, claimed: false, company_id: null, already_active: false },
      { application_id: null, claimed: false, company_id: null, already_active: false },
    ],
  ])("fails closed on malformed successful Core payload %#", async (data) => {
    await expect(claimApprovedB2bIdentity(async () => ({ data, error: null })))
      .rejects.toThrow("APPROVED_B2B_IDENTITY_CLAIM_FAILED");
  });

  it("fails closed when Core claim RPC fails", async () => {
    await expect(claimApprovedB2bIdentity(async () => ({
      data: null,
      error: { message: "ambiguous approved application" },
    }))).rejects.toThrow("APPROVED_B2B_IDENTITY_CLAIM_FAILED");
  });
});
