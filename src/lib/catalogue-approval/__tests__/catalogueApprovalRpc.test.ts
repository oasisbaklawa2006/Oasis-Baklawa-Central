import { describe, expect, it } from "vitest";
import {
  CATALOGUE_APPROVAL_MESSAGES,
  outcomeFromRpcResult,
  outcomeFromSupabaseError,
  parseCatalogueApprovalRpcResult,
} from "../index";

describe("catalogue approval RPC parsing", () => {
  it("tag approval success", () => {
    const rpc = parseCatalogueApprovalRpcResult({
      ok: true,
      action: "approved",
      draft_table: "catalogue_tag_drafts",
      draft_id: "d-1",
      tag_key: "general:premium",
    });
    const outcome = outcomeFromRpcResult("tag", rpc);
    expect(outcome.success).toBe(true);
    expect(outcome.kind).toBe("tag_approved");
    expect(outcome.message).toBe(CATALOGUE_APPROVAL_MESSAGES.tagApproved);
  });

  it("alias approval success", () => {
    const rpc = parseCatalogueApprovalRpcResult({
      ok: true,
      action: "approved",
      draft_table: "catalogue_alias_drafts",
      draft_id: "d-2",
      target_record_id: "alias-uuid",
    });
    const outcome = outcomeFromRpcResult("alias", rpc);
    expect(outcome.success).toBe(true);
    expect(outcome.kind).toBe("alias_approved");
    expect(outcome.message).toBe(CATALOGUE_APPROVAL_MESSAGES.aliasApproved);
  });

  it("ok:false soft block for mapping not finalized", () => {
    const rpc = parseCatalogueApprovalRpcResult({
      ok: false,
      action: "approve_blocked_mapping_not_finalized",
      message: "Approval mapping not finalized for this draft type",
    });
    const outcome = outcomeFromRpcResult("tag", rpc);
    expect(outcome.success).toBe(false);
    expect(outcome.kind).toBe("mapping_not_finalized");
    expect(outcome.message).toBe(CATALOGUE_APPROVAL_MESSAGES.mappingNotFinalized);
  });

  it("reject success", () => {
    const rpc = parseCatalogueApprovalRpcResult({
      ok: true,
      action: "rejected",
      draft_id: "d-3",
    });
    const outcome = outcomeFromRpcResult("alias", rpc);
    expect(outcome.success).toBe(true);
    expect(outcome.kind).toBe("rejected");
    expect(outcome.message).toBe(CATALOGUE_APPROVAL_MESSAGES.rejected);
  });

  it("not authorized from supabase error", () => {
    const outcome = outcomeFromSupabaseError(
      "Catalogue reviewer permission required",
      "tag",
    );
    expect(outcome.kind).toBe("not_authorized");
    expect(outcome.message).toBe(CATALOGUE_APPROVAL_MESSAGES.notAuthorized);
    expect(outcome.rpc).toBeUndefined();
  });

  it("supabase error uses kind-specific client action on failed outcome", () => {
    const tagOutcome = outcomeFromSupabaseError("connection reset", "tag");
    expect(tagOutcome.kind).toBe("failed");
    expect(tagOutcome.rpc?.action).toBe("tag_error");

    const aliasOutcome = outcomeFromSupabaseError("connection reset", "alias");
    expect(aliasOutcome.rpc?.action).toBe("alias_error");
  });

  // Point 27, Finding 2: pricing/moq approval is Central-only authority.
  it("pricing approval success", () => {
    const rpc = parseCatalogueApprovalRpcResult({
      ok: true,
      action: "approved",
      draft_table: "catalogue_pricing_drafts",
      draft_id: "d-4",
    });
    const outcome = outcomeFromRpcResult("pricing", rpc);
    expect(outcome.success).toBe(true);
    expect(outcome.kind).toBe("pricing_approved");
    expect(outcome.message).toBe(CATALOGUE_APPROVAL_MESSAGES.pricingApproved);
  });

  it("moq approval success", () => {
    const rpc = parseCatalogueApprovalRpcResult({
      ok: true,
      action: "approved",
      draft_table: "catalogue_moq_drafts",
      draft_id: "d-5",
    });
    const outcome = outcomeFromRpcResult("moq", rpc);
    expect(outcome.success).toBe(true);
    expect(outcome.kind).toBe("moq_approved");
    expect(outcome.message).toBe(CATALOGUE_APPROVAL_MESSAGES.moqApproved);
  });

  it("supabase error uses kind-specific client action for pricing/moq", () => {
    const pricingOutcome = outcomeFromSupabaseError("connection reset", "pricing");
    expect(pricingOutcome.rpc?.action).toBe("pricing_error");

    const moqOutcome = outcomeFromSupabaseError("connection reset", "moq");
    expect(moqOutcome.rpc?.action).toBe("moq_error");
  });
});
