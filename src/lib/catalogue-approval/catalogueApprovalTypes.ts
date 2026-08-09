// "pricing" and "moq" are Central/Core-governed commercial authority
// (Point 27, Finding 2): AI Studio may only submit these as drafts, and
// Central is the only app that may approve or reject them.
export type CatalogueDraftKind = "tag" | "alias" | "pricing" | "moq";

export type CatalogueDraftTable =
  | "catalogue_tag_drafts"
  | "catalogue_alias_drafts"
  | "catalogue_pricing_drafts"
  | "catalogue_moq_drafts";

export const CATALOGUE_DRAFT_TABLE_BY_KIND: Record<CatalogueDraftKind, CatalogueDraftTable> = {
  tag: "catalogue_tag_drafts",
  alias: "catalogue_alias_drafts",
  pricing: "catalogue_pricing_drafts",
  moq: "catalogue_moq_drafts",
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

export interface CataloguePricingDraftView {
  kind: "pricing";
  draftId: string;
  operation: string;
  product_id: string | null;
  price_channel: string | null;
  price_type: string | null;
  calculated_price: number | null;
  currency: string | null;
  submitted_at: string | null;
}

export interface CatalogueMoqDraftView {
  kind: "moq";
  draftId: string;
  operation: string;
  product_id: string | null;
  channel: string | null;
  moq_applicable: boolean | null;
  moq_value: number | null;
  moq_uom: string | null;
  submitted_at: string | null;
}

export type CatalogueDraftView =
  | CatalogueTagDraftView
  | CatalogueAliasDraftView
  | CataloguePricingDraftView
  | CatalogueMoqDraftView;

/** Known RPC actions from Central Supabase approve/reject functions. */
export type CatalogueApprovalRpcAction =
  | "approved"
  | "rejected"
  | "approve_blocked_mapping_not_finalized";

/** Client-side action labels when Supabase returns a non-auth error. */
export type CatalogueApprovalClientErrorAction =
  | "tag_error"
  | "alias_error"
  | "pricing_error"
  | "moq_error";

export type CatalogueApprovalAction =
  | CatalogueApprovalRpcAction
  | CatalogueApprovalClientErrorAction;

export interface CatalogueApprovalRpcResult {
  ok: boolean;
  action?: CatalogueApprovalAction;
  message?: string;
  draft_table?: string;
  draft_id?: string;
  target_record_id?: string;
  tag_key?: string;
}

export type CatalogueApprovalOutcomeKind =
  | "tag_approved"
  | "alias_approved"
  | "pricing_approved"
  | "moq_approved"
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
