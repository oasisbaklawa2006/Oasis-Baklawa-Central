export type CatalogueDraftKind = "tag" | "alias";

export type CatalogueDraftTable = "catalogue_tag_drafts" | "catalogue_alias_drafts";

export const CATALOGUE_DRAFT_TABLE_BY_KIND: Record<CatalogueDraftKind, CatalogueDraftTable> = {
  tag: "catalogue_tag_drafts",
  alias: "catalogue_alias_drafts",
};

export const PENDING_CATALOGUE_DRAFT_STATUS = "pending_approval";

export interface CatalogueDraftRow {
  id: string;
  operation: string;
  status: string;
  payload: Record<string, unknown>;
  submitted_at: string | null;
  target_record_id: string | null;
}

export interface CatalogueTagDraftView {
  kind: "tag";
  draftId: string;
  operation: string;
  tag_key: string | null;
  tag_label: string | null;
  is_active: boolean | null;
  submitted_at: string | null;
}

export interface CatalogueAliasDraftView {
  kind: "alias";
  draftId: string;
  operation: string;
  alias_text: string | null;
  canonical_name: string | null;
  product_id: string | null;
  submitted_at: string | null;
}

export type CatalogueDraftView = CatalogueTagDraftView | CatalogueAliasDraftView;

export type CatalogueApprovalRpcAction =
  | "approved"
  | "rejected"
  | "approve_blocked_mapping_not_finalized";

export interface CatalogueApprovalRpcResult {
  ok: boolean;
  action?: string;
  message?: string;
  draft_table?: string;
  draft_id?: string;
  target_record_id?: string;
  tag_key?: string;
}

export type CatalogueApprovalOutcomeKind =
  | "tag_approved"
  | "alias_approved"
  | "rejected"
  | "mapping_not_finalized"
  | "not_authorized"
  | "failed";

export interface CatalogueApprovalOutcome {
  kind: CatalogueApprovalOutcomeKind;
  success: boolean;
  message: string;
  rpc?: CatalogueApprovalRpcResult;
}
