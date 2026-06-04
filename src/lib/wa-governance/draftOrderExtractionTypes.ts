import type { ClientResolutionConfidenceBand } from "./clientResolutionTypes";
import type { ProductResolutionConfidenceBand } from "./productResolutionTypes";
import type { QuantityResolutionConfidenceBand } from "./quantityResolutionTypes";

export type DraftOrderReadinessDimensionKey =
  | "client"
  | "product"
  | "quantity"
  | "address"
  | "payment_terms";

export type DraftOrderReadinessStatus = "ready" | "partial" | "missing";

export interface DraftOrderReadinessDimension {
  dimension: DraftOrderReadinessDimensionKey;
  score: number;
  status: DraftOrderReadinessStatus;
  explanation: string;
}

export interface DraftOrderLineItem {
  lineIndex: number;
  productId: string | null;
  productName: string;
  sku: string | null;
  rawQuantity: number;
  rawUnit: string | null;
  normalizedQuantity: number | null;
  normalizedUnit: string | null;
  productConfidence: number | null;
  quantityConfidence: number;
  productBand: ProductResolutionConfidenceBand | null;
  quantityBand: QuantityResolutionConfidenceBand;
  originalTextSpan: string | null;
  conversionExplanation: string | null;
  resolutionReasons: string[];
}

export interface DraftOrderClientSnapshot {
  companyId: string | null;
  companyName: string | null;
  ownerId: string | null;
  ownerName: string | null;
  confidence: number | null;
  band: ClientResolutionConfidenceBand | null;
  explanation: string[];
}

export interface DraftOrderGovernanceRoles {
  clientOwnerId: string | null;
  clientOwnerName: string | null;
  orderCreatorId: string | null;
  orderCreatorName: string | null;
  orderHandlerId: string | null;
  orderHandlerName: string | null;
  approverId: string | null;
  approverName: string | null;
  preservationNotes: string[];
}

export interface DraftOrderReadinessSnapshot {
  overallScore: number;
  dimensions: DraftOrderReadinessDimension[];
}

export type DraftOrderExtractionStatus =
  | "idle"
  | "upstream_loading"
  | "upstream_error"
  | "ready";

export interface ExtractedDraftOrder {
  packetId: string;
  extractionRequestKey: string;
  status: DraftOrderExtractionStatus;
  sourceText: string;
  client: DraftOrderClientSnapshot;
  lineItems: DraftOrderLineItem[];
  readiness: DraftOrderReadinessSnapshot;
  governance: DraftOrderGovernanceRoles;
  conversionSummary: string[];
  upstreamErrorMessage: string | null;
}

export type DraftOrderLocalDecision = "pending" | "approved" | "rejected";

export interface DraftOrderLocalEdits {
  lineQuantities: Record<number, number>;
  decision: DraftOrderLocalDecision;
  updatedAt: string;
}
