import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";
import {
  CATALOGUE_DRAFT_TABLE_BY_KIND,
  PENDING_CATALOGUE_DRAFT_STATUS,
  type CatalogueApprovalOutcome,
  type CatalogueDraftKind,
  type CatalogueDraftRow,
  type CatalogueDraftView,
} from "./catalogueApprovalTypes";
import { parseCatalogueDraftView } from "./parseCatalogueApprovalPayload";
import {
  outcomeFromRpcResult,
  outcomeFromSupabaseError,
  parseCatalogueApprovalRpcResult,
} from "./parseCatalogueApprovalRpcResult";

type CentralSupabase = SupabaseClient<Database>;

const DRAFT_SELECT = "id, operation, status, payload, submitted_at, target_record_id";

const APPROVE_RPC_BY_KIND = {
  tag: "approve_catalogue_tag_draft",
  alias: "approve_catalogue_alias_draft",
  pricing: "approve_catalogue_pricing_draft",
  moq: "approve_catalogue_moq_draft",
} as const;

const REJECT_RPC_BY_KIND = {
  tag: "reject_catalogue_tag_draft",
  alias: "reject_catalogue_alias_draft",
  pricing: "reject_catalogue_pricing_draft",
  moq: "reject_catalogue_moq_draft",
} as const;

export interface CatalogueApprovalService {
  listPendingTagDrafts(): Promise<CatalogueDraftView[]>;
  listPendingAliasDrafts(): Promise<CatalogueDraftView[]>;
  listPendingPricingDrafts(): Promise<CatalogueDraftView[]>;
  listPendingMoqDrafts(): Promise<CatalogueDraftView[]>;
  approveTagDraft(draftId: string): Promise<CatalogueApprovalOutcome>;
  approveAliasDraft(draftId: string): Promise<CatalogueApprovalOutcome>;
  approvePricingDraft(draftId: string): Promise<CatalogueApprovalOutcome>;
  approveMoqDraft(draftId: string): Promise<CatalogueApprovalOutcome>;
  rejectTagDraft(draftId: string, reason: string): Promise<CatalogueApprovalOutcome>;
  rejectAliasDraft(draftId: string, reason: string): Promise<CatalogueApprovalOutcome>;
  rejectPricingDraft(draftId: string, reason: string): Promise<CatalogueApprovalOutcome>;
  rejectMoqDraft(draftId: string, reason: string): Promise<CatalogueApprovalOutcome>;
}

export function createCatalogueApprovalService(
  client: CentralSupabase,
): CatalogueApprovalService {
  async function listPending(kind: CatalogueDraftKind): Promise<CatalogueDraftView[]> {
    const table = CATALOGUE_DRAFT_TABLE_BY_KIND[kind];
    const { data, error } = await client
      .from(table)
      .select(DRAFT_SELECT)
      .eq("status", PENDING_CATALOGUE_DRAFT_STATUS)
      .order("submitted_at", { ascending: false });

    if (error) {
      throw new Error(error.message);
    }

    return (data ?? []).map((row) =>
      parseCatalogueDraftView(kind, row as CatalogueDraftRow),
    );
  }

  async function callApprove(
    kind: CatalogueDraftKind,
    draftId: string,
  ): Promise<CatalogueApprovalOutcome> {
    const rpcName = APPROVE_RPC_BY_KIND[kind];
    const { data, error } = await client.rpc(rpcName, { draft_id: draftId });

    if (error) {
      return outcomeFromSupabaseError(error.message, kind);
    }

    return outcomeFromRpcResult(kind, parseCatalogueApprovalRpcResult(data));
  }

  async function callReject(
    kind: CatalogueDraftKind,
    draftId: string,
    reason: string,
  ): Promise<CatalogueApprovalOutcome> {
    const rpcName = REJECT_RPC_BY_KIND[kind];
    const { data, error } = await client.rpc(rpcName, {
      draft_id: draftId,
      reason: reason.trim() || "Rejected by reviewer",
    });

    if (error) {
      return outcomeFromSupabaseError(error.message, kind);
    }

    return outcomeFromRpcResult(kind, parseCatalogueApprovalRpcResult(data));
  }

  return {
    listPendingTagDrafts: () => listPending("tag"),
    listPendingAliasDrafts: () => listPending("alias"),
    listPendingPricingDrafts: () => listPending("pricing"),
    listPendingMoqDrafts: () => listPending("moq"),
    approveTagDraft: (draftId) => callApprove("tag", draftId),
    approveAliasDraft: (draftId) => callApprove("alias", draftId),
    approvePricingDraft: (draftId) => callApprove("pricing", draftId),
    approveMoqDraft: (draftId) => callApprove("moq", draftId),
    rejectTagDraft: (draftId, reason) => callReject("tag", draftId, reason),
    rejectAliasDraft: (draftId, reason) => callReject("alias", draftId, reason),
    rejectPricingDraft: (draftId, reason) => callReject("pricing", draftId, reason),
    rejectMoqDraft: (draftId, reason) => callReject("moq", draftId, reason),
  };
}

/** Guardrail: Central C1a uses `product_tags` / `product_aliases`, not legacy tables. */
export const CATALOGUE_APPROVAL_LEGACY_FORBIDDEN = [
  'from("tags")',
  ".from('tags')",
  "normalized_alias",
  "product_aliases.alias",
] as const;
