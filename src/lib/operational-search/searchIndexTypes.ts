/** Persistent operational search index (Phase 3I). */

export type SearchIndexEntityType =
  | "order"
  | "queue_item"
  | "operational_event"
  | "scan_record"
  | "customer"
  | "complaint"
  | "dispatch_reference"
  | "carton";

export type SearchIndexVisibility = "internal" | "staff_scoped" | "customer_safe_candidate";

export type SearchIndexSensitivity = "normal" | "restricted" | "confidential";

export interface SearchIndexEntry {
  id?: string;
  entityType: SearchIndexEntityType;
  entityId: string;
  orderId: string | null;
  customerId: string | null;
  queueItemId: string | null;
  scanRecordId: string | null;
  eventId: string | null;
  publicRef: string | null;
  searchTitle: string;
  searchSubtitle: string | null;
  searchBody: string | null;
  normalizedTokens: string[];
  aliases: string[];
  barcodeValues: string[];
  soNumbers: string[];
  phoneTokens: string[];
  emailTokens: string[];
  department: string | null;
  visibility: SearchIndexVisibility;
  sensitivity: SearchIndexSensitivity;
  source: string;
  metadata: Record<string, unknown>;
  updatedAt?: string;
  createdAt?: string;
}

export interface SearchIndexUpsertInput extends Omit<SearchIndexEntry, "id" | "updatedAt" | "createdAt"> {}

export interface OperationalSearchIndexQuery {
  text: string;
  entityTypes?: SearchIndexEntityType[];
  department?: string | null;
  sensitivity?: SearchIndexSensitivity | null;
  visibility?: SearchIndexVisibility | null;
  barcodeOrSoMode?: boolean;
  updatedAfter?: string | null;
  updatedBefore?: string | null;
  limit?: number;
}

export interface OperationalSearchIndexResultCard {
  id: string;
  entityType: SearchIndexEntityType;
  entityId: string;
  orderId: string | null;
  publicRef: string | null;
  searchTitle: string;
  searchSubtitle: string | null;
  visibility: SearchIndexVisibility;
  sensitivity: SearchIndexSensitivity;
  source: string;
  department: string | null;
  updatedAt: string;
  navigationPath: string;
  rankScore: number;
}

export interface OperationalSearchIndexQueryResult {
  cards: OperationalSearchIndexResultCard[];
  totalMatched: number;
  suppressedCount: number;
  queryTokens: string[];
  generatedAt: string;
}

export interface SearchAuthorityContext {
  role: string;
  departments: string[];
  canViewConfidential: boolean;
  canViewRestricted: boolean;
}
