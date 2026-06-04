import { describe, expect, it } from "vitest";
import { buildSalesOrderDraftComparisonView } from "@/lib/wa-sales-order-draft/buildComparisonView";
import {
  buildDraftHeaderInsert,
  buildOperatorFinalSnapshot,
  resolveOperatorQuantity,
} from "@/lib/wa-sales-order-draft/mapExtractedDraft";
import { validateSalesOrderDraftReadiness } from "@/lib/wa-sales-order-draft/readinessValidation";
import type { SalesOrderDraftBundle } from "@/lib/wa-sales-order-draft/types";
import { getNextStatus, isTerminalStatus } from "@/lib/wa-sales-order-draft/workflowTransitions";
import type { ExtractedDraftOrder } from "@/lib/wa-governance/draftOrderExtractionTypes";

const extractedFixture: ExtractedDraftOrder = {
  packetId: "pkt-1",
  extractionRequestKey: "key-1",
  status: "ready",
  sourceText: "10 boxes baklawa for Bikaner. Pincode 110001. Advance payment.",
  client: {
    companyId: "co-1",
    companyName: "Bikaner Traders",
    ownerId: "owner-1",
    ownerName: "Priya Sales",
    confidence: 88,
    band: "auto_highlight",
    explanation: [],
  },
  lineItems: [
    {
      lineIndex: 0,
      productId: "prod-1",
      productName: "Premium Baklawa Box",
      sku: "BKW-500",
      rawQuantity: 10,
      rawUnit: "boxes",
      normalizedQuantity: 10,
      normalizedUnit: "boxes",
      productConfidence: 76,
      quantityConfidence: 91,
      productBand: "suggested",
      quantityBand: "auto_highlight",
      originalTextSpan: "10 boxes baklawa",
      conversionExplanation: "Catalogue match",
      resolutionReasons: [],
    },
  ],
  readiness: {
    overallScore: 72,
    dimensions: [
      { dimension: "client", score: 88, status: "ready", explanation: "Client ok" },
      { dimension: "product", score: 76, status: "ready", explanation: "Product ok" },
      { dimension: "quantity", score: 91, status: "ready", explanation: "Qty ok" },
      { dimension: "address", score: 55, status: "partial", explanation: "Pincode" },
      { dimension: "payment_terms", score: 50, status: "partial", explanation: "Advance" },
    ],
  },
  governance: {
    clientOwnerId: "owner-1",
    clientOwnerName: "Priya Sales",
    orderCreatorId: "emp-1",
    orderCreatorName: "Rahul Ops",
    orderHandlerId: "owner-1",
    orderHandlerName: "Priya Sales",
    approverId: null,
    approverName: null,
    preservationNotes: ["Approver reserved for human"],
  },
  conversionSummary: ["Does not insert into orders table."],
  upstreamErrorMessage: null,
};

describe("sales order draft workflow", () => {
  it("allows AI_DRAFT → UNDER_REVIEW → APPROVED_FOR_SO", () => {
    expect(getNextStatus("AI_DRAFT", "SUBMIT_REVIEW")).toBe("UNDER_REVIEW");
    expect(getNextStatus("UNDER_REVIEW", "APPROVE")).toBe("APPROVED_FOR_SO");
    expect(isTerminalStatus("APPROVED_FOR_SO")).toBe(true);
  });

  it("blocks approve transition from AI_DRAFT", () => {
    expect(getNextStatus("AI_DRAFT", "APPROVE")).toBeNull();
  });

  it("rejects draft from reviewable states", () => {
    expect(getNextStatus("AI_DRAFT", "REJECT")).toBe("REJECTED");
    expect(getNextStatus("UNDER_REVIEW", "REJECT")).toBe("REJECTED");
    expect(isTerminalStatus("REJECTED")).toBe(true);
  });
});

describe("readiness validation", () => {
  it("passes when all five dimensions meet minimum threshold", () => {
    const result = validateSalesOrderDraftReadiness(extractedFixture.readiness.dimensions);
    expect(result.valid).toBe(true);
    expect(result.blockingDimensions).toHaveLength(0);
  });

  it("blocks approval when a dimension is missing", () => {
    const result = validateSalesOrderDraftReadiness([
      { dimension: "client", score: 0, status: "missing", explanation: "No client" },
      { dimension: "product", score: 76, status: "ready", explanation: "ok" },
      { dimension: "quantity", score: 91, status: "ready", explanation: "ok" },
      { dimension: "address", score: 55, status: "partial", explanation: "ok" },
      { dimension: "payment_terms", score: 50, status: "partial", explanation: "ok" },
    ]);
    expect(result.valid).toBe(false);
    expect(result.blockingDimensions[0].dimension).toBe("client");
  });
});

describe("map extracted draft", () => {
  it("captures operator quantity overrides in operator final snapshot", () => {
    const snapshot = buildOperatorFinalSnapshot(extractedFixture, { 0: 12 });
    expect(snapshot.lineItems[0].quantity).toBe(12);
    expect(snapshot.lineItems[0].source).toBe("operator_edit");
  });

  it("builds header insert without orders table references", () => {
    const header = buildDraftHeaderInsert({
      extracted: extractedFixture,
      operatorLineQuantities: { 0: 12 },
      actor: { id: "user-1", name: "Reviewer" },
    });
    expect(header.status).toBe("AI_DRAFT");
    expect(header.packet_id).toBe("pkt-1");
    expect(header.promoted_order_id).toBeUndefined();
    expect(JSON.stringify(header)).not.toMatch(/"orders"/);
  });

  it("defaults operator quantity from AI when no local edit", () => {
    const resolved = resolveOperatorQuantity(0, extractedFixture, {});
    expect(resolved.quantity).toBe(10);
    expect(resolved.source).toBe("ai");
  });
});

describe("comparison view", () => {
  it("flags line changes between AI and operator final", () => {
    const bundle: SalesOrderDraftBundle = {
      draft: {
        id: "draft-1",
        packet_id: "pkt-1",
        extraction_request_key: "key-1",
        status: "UNDER_REVIEW",
        client_owner_id: null,
        client_owner_name: null,
        order_creator_id: null,
        order_creator_name: null,
        order_handler_id: null,
        order_handler_name: null,
        approver_id: null,
        approver_name: null,
        company_id: "co-1",
        company_name: "Bikaner Traders",
        readiness_overall_score: 72,
        readiness_dimensions: extractedFixture.readiness.dimensions,
        original_whatsapp_text: extractedFixture.sourceText,
        ai_draft_snapshot: extractedFixture,
        operator_final_snapshot: buildOperatorFinalSnapshot(extractedFixture, { 0: 12 }),
        review_notes: null,
        rejection_reason: null,
        promoted_order_id: null,
        created_by: "user-1",
        updated_by: "user-1",
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      },
      lines: [
        {
          id: "line-1",
          draft_id: "draft-1",
          line_index: 0,
          product_id: "prod-1",
          product_name: "Premium Baklawa Box",
          sku: "BKW-500",
          raw_quantity: 10,
          raw_unit: "boxes",
          normalized_quantity: 10,
          normalized_unit: "boxes",
          operator_quantity: 12,
          original_text_span: "10 boxes baklawa",
          conversion_explanation: null,
          product_confidence: 76,
          quantity_confidence: 91,
          ai_line_snapshot: {},
          operator_line_snapshot: { quantity: 12, source: "operator_edit" },
        },
      ],
      auditLog: [],
    };

    const view = buildSalesOrderDraftComparisonView(bundle);
    expect(view.lines[0].changed).toBe(true);
    expect(view.originalWhatsAppExcerpt).toContain("10 boxes baklawa");
  });
});

describe("forbidden auto promotion guard (static)", () => {
  it("repository module never mutates orders table", async () => {
    const { readFileSync } = await import("node:fs");
    const { join } = await import("node:path");
    const repo = readFileSync(
      join(import.meta.dirname, "../salesOrderDraftRepository.ts"),
      "utf8",
    );
    expect(repo).not.toMatch(/from\("orders"\)/);
    expect(repo).not.toMatch(/promoted_order_id:\s*[^n]/);
  });
});
