import type {
  DraftOrderGovernanceRoles,
  DraftOrderLineItem,
  DraftOrderReadinessDimension,
  DraftOrderReadinessSnapshot,
  ExtractedDraftOrder,
} from "@/lib/wa-governance/draftOrderExtractionTypes";

export type SalesOrderDraftStatus =
  | "AI_DRAFT"
  | "UNDER_REVIEW"
  | "APPROVED_FOR_SO"
  | "REJECTED";

export type SalesOrderDraftAuditAction =
  | "CREATE"
  | "SUBMIT_REVIEW"
  | "UPDATE_OPERATOR_FINAL"
  | "APPROVE"
  | "REJECT"
  | "REOPEN";

export interface SalesOrderDraftActor {
  id: string;
  name: string;
}

export interface SalesOrderDraftLineRow {
  id: string;
  draft_id: string;
  line_index: number;
  product_id: string | null;
  product_name: string;
  sku: string | null;
  raw_quantity: number;
  raw_unit: string | null;
  normalized_quantity: number | null;
  normalized_unit: string | null;
  operator_quantity: number | null;
  original_text_span: string | null;
  conversion_explanation: string | null;
  product_confidence: number | null;
  quantity_confidence: number | null;
  ai_line_snapshot: Record<string, unknown>;
  operator_line_snapshot: Record<string, unknown>;
}

export interface SalesOrderDraftRow {
  id: string;
  packet_id: string;
  extraction_request_key: string;
  status: SalesOrderDraftStatus;
  client_owner_id: string | null;
  client_owner_name: string | null;
  order_creator_id: string | null;
  order_creator_name: string | null;
  order_handler_id: string | null;
  order_handler_name: string | null;
  approver_id: string | null;
  approver_name: string | null;
  company_id: string | null;
  company_name: string | null;
  readiness_overall_score: number;
  readiness_dimensions: DraftOrderReadinessDimension[];
  original_whatsapp_text: string;
  ai_draft_snapshot: ExtractedDraftOrder;
  operator_final_snapshot: OperatorFinalSnapshot;
  review_notes: string | null;
  rejection_reason: string | null;
  promoted_order_id: string | null;
  created_by: string | null;
  updated_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface OperatorFinalLineSnapshot {
  lineIndex: number;
  productId: string | null;
  productName: string;
  sku: string | null;
  quantity: number;
  unit: string | null;
  source: "ai" | "operator_edit";
}

export interface OperatorFinalSnapshot {
  capturedAt: string;
  lineItems: OperatorFinalLineSnapshot[];
  governance: DraftOrderGovernanceRoles;
  readiness: DraftOrderReadinessSnapshot;
}

export interface SalesOrderDraftAuditEntry {
  id: string;
  draft_id: string;
  action: SalesOrderDraftAuditAction;
  from_status: SalesOrderDraftStatus | null;
  to_status: SalesOrderDraftStatus | null;
  actor_id: string | null;
  actor_name: string | null;
  metadata: Record<string, unknown>;
  created_at: string;
}

export interface SalesOrderDraftBundle {
  draft: SalesOrderDraftRow;
  lines: SalesOrderDraftLineRow[];
  auditLog: SalesOrderDraftAuditEntry[];
}

export interface ComparisonLineView {
  lineIndex: number;
  originalTextSpan: string | null;
  aiProductName: string;
  aiQuantity: number | null;
  aiUnit: string | null;
  operatorProductName: string;
  operatorQuantity: number | null;
  operatorUnit: string | null;
  changed: boolean;
}

export interface SalesOrderDraftComparisonView {
  originalWhatsAppExcerpt: string;
  aiDraftSummary: string;
  operatorFinalSummary: string;
  lines: ComparisonLineView[];
}

export interface ReadinessValidationResult {
  valid: boolean;
  blockingDimensions: DraftOrderReadinessDimension[];
  messages: string[];
}

export interface CreateSalesOrderDraftInput {
  extracted: ExtractedDraftOrder;
  operatorLineQuantities: Record<number, number>;
  actor: SalesOrderDraftActor;
}

export interface TransitionSalesOrderDraftInput {
  draftId: string;
  actor: SalesOrderDraftActor;
  reviewNotes?: string;
  rejectionReason?: string;
}

export interface SubmitSalesOrderDraftForReviewInput {
  draftId: string;
  extracted: ExtractedDraftOrder | null;
  operatorLineQuantities: Record<number, number>;
  actor: SalesOrderDraftActor;
}

export type DraftOrderLineItemLike = Pick<
  DraftOrderLineItem,
  | "lineIndex"
  | "productId"
  | "productName"
  | "sku"
  | "rawQuantity"
  | "rawUnit"
  | "normalizedQuantity"
  | "normalizedUnit"
  | "originalTextSpan"
  | "conversionExplanation"
  | "productConfidence"
  | "quantityConfidence"
>;
