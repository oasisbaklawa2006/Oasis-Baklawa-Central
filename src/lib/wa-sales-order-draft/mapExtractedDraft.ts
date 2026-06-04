import type { Database, Json } from "@/integrations/supabase/types";
import type { ExtractedDraftOrder } from "@/lib/wa-governance/draftOrderExtractionTypes";
import type {
  CreateSalesOrderDraftInput,
  OperatorFinalLineSnapshot,
  OperatorFinalSnapshot,
} from "./types";

type DraftInsert = Database["public"]["Tables"]["sales_order_drafts"]["Insert"];
type DraftLineInsert = Database["public"]["Tables"]["sales_order_draft_lines"]["Insert"];

export function resolveOperatorQuantity(
  lineIndex: number,
  extracted: ExtractedDraftOrder,
  operatorLineQuantities: Record<number, number>,
): { quantity: number; source: "ai" | "operator_edit" } {
  if (Object.prototype.hasOwnProperty.call(operatorLineQuantities, lineIndex)) {
    return { quantity: operatorLineQuantities[lineIndex], source: "operator_edit" };
  }
  const line = extracted.lineItems.find((item) => item.lineIndex === lineIndex);
  const quantity = line?.normalizedQuantity ?? line?.rawQuantity ?? 0;
  return { quantity, source: "ai" };
}

export function buildOperatorFinalSnapshot(
  extracted: ExtractedDraftOrder,
  operatorLineQuantities: Record<number, number>,
): OperatorFinalSnapshot {
  const lineItems: OperatorFinalLineSnapshot[] = extracted.lineItems.map((line) => {
    const resolved = resolveOperatorQuantity(line.lineIndex, extracted, operatorLineQuantities);
    return {
      lineIndex: line.lineIndex,
      productId: line.productId,
      productName: line.productName,
      sku: line.sku,
      quantity: resolved.quantity,
      unit: line.normalizedUnit ?? line.rawUnit,
      source: resolved.source,
    };
  });

  return {
    capturedAt: new Date().toISOString(),
    lineItems,
    governance: extracted.governance,
    readiness: extracted.readiness,
  };
}

export type DraftLineRpcPayload = Omit<DraftLineInsert, "draft_id">;

export function buildDraftLineRpcPayloads(
  extracted: ExtractedDraftOrder,
  operatorLineQuantities: Record<number, number>,
): DraftLineRpcPayload[] {
  return buildDraftLineInserts("", extracted, operatorLineQuantities).map(
    ({ draft_id: _draftId, ...line }) => line,
  );
}

export function buildDraftHeaderRpcPayload(
  input: CreateSalesOrderDraftInput,
): Record<string, unknown> {
  const header = buildDraftHeaderInsert(input);
  return {
    packet_id: header.packet_id,
    extraction_request_key: header.extraction_request_key,
    status: header.status,
    client_owner_id: header.client_owner_id,
    client_owner_name: header.client_owner_name,
    order_creator_id: header.order_creator_id,
    order_creator_name: header.order_creator_name,
    order_handler_id: header.order_handler_id,
    order_handler_name: header.order_handler_name,
    approver_id: header.approver_id,
    approver_name: header.approver_name,
    company_id: header.company_id,
    company_name: header.company_name,
    readiness_overall_score: header.readiness_overall_score,
    readiness_dimensions: header.readiness_dimensions,
    original_whatsapp_text: header.original_whatsapp_text,
    ai_draft_snapshot: header.ai_draft_snapshot,
    operator_final_snapshot: header.operator_final_snapshot,
  };
}

export function buildDraftLineInserts(
  draftId: string,
  extracted: ExtractedDraftOrder,
  operatorLineQuantities: Record<number, number>,
): DraftLineInsert[] {
  return extracted.lineItems.map((line) => {
    const resolved = resolveOperatorQuantity(line.lineIndex, extracted, operatorLineQuantities);
    return {
      draft_id: draftId,
      line_index: line.lineIndex,
      product_id: line.productId,
      product_name: line.productName,
      sku: line.sku,
      raw_quantity: line.rawQuantity,
      raw_unit: line.rawUnit,
      normalized_quantity: line.normalizedQuantity,
      normalized_unit: line.normalizedUnit,
      operator_quantity: resolved.quantity,
      original_text_span: line.originalTextSpan,
      conversion_explanation: line.conversionExplanation,
      product_confidence: line.productConfidence,
      quantity_confidence: line.quantityConfidence,
      ai_line_snapshot: { ...line } as unknown as Json,
      operator_line_snapshot: {
        quantity: resolved.quantity,
        unit: line.normalizedUnit ?? line.rawUnit,
        source: resolved.source,
      } as unknown as Json,
    };
  });
}

export function buildDraftHeaderInsert(input: CreateSalesOrderDraftInput): DraftInsert {
  const { extracted, operatorLineQuantities, actor } = input;
  const operatorFinal = buildOperatorFinalSnapshot(extracted, operatorLineQuantities);

  return {
    packet_id: extracted.packetId,
    extraction_request_key: extracted.extractionRequestKey,
    status: "AI_DRAFT",
    client_owner_id: extracted.governance.clientOwnerId,
    client_owner_name: extracted.governance.clientOwnerName,
    order_creator_id: extracted.governance.orderCreatorId,
    order_creator_name: extracted.governance.orderCreatorName,
    order_handler_id: extracted.governance.orderHandlerId,
    order_handler_name: extracted.governance.orderHandlerName,
    approver_id: null,
    approver_name: null,
    company_id: extracted.client.companyId,
    company_name: extracted.client.companyName,
    readiness_overall_score: extracted.readiness.overallScore,
    readiness_dimensions: extracted.readiness.dimensions as unknown as Json,
    original_whatsapp_text: extracted.sourceText,
    ai_draft_snapshot: extracted as unknown as Json,
    operator_final_snapshot: operatorFinal as unknown as Json,
    created_by: actor.id,
    updated_by: actor.id,
  };
}
