import type { OperationalSearchKind } from "./searchEntityContracts";

/**
 * Future search index contract — no persistence or indexing job in this PR.
 */
export interface SearchFeedIndexField {
  kind: OperationalSearchKind | "product_sku" | "queue" | "blocker" | "department";
  field: string;
  description: string;
  /** True when a safe read model exists today. */
  availableNow: boolean;
}

export const SEARCH_FEED_INDEX_CONTRACT: SearchFeedIndexField[] = [
  { kind: "so_number", field: "orders.id", description: "Sales order UUID / SO label", availableNow: true },
  { kind: "customer", field: "companies.business_name", description: "Customer / company name", availableNow: true },
  { kind: "phone", field: "companies.phone", description: "Company phone when present on company row", availableNow: true },
  { kind: "product_sku", field: "order_items.product_id", description: "Product line linkage", availableNow: true },
  { kind: "dispatch", field: "orders.status", description: "Dispatch-critical statuses", availableNow: true },
  { kind: "invoice", field: "orders.payment_status", description: "Payment / invoice lane proxy", availableNow: true },
  { kind: "queue", field: "work_queue.projection", description: "Live work queue membership", availableNow: true },
  { kind: "blocker", field: "dependency_graph.root_blocker", description: "Root blocker lane label", availableNow: true },
  { kind: "department", field: "entity_ownership.primaryOwner", description: "Owner role / department proxy", availableNow: true },
  { kind: "whatsapp_packet", field: "whatsapp_message_packets", description: "Operator packet id", availableNow: false },
  { kind: "barcode", field: "scan_events", description: "Barcode scan store", availableNow: false },
  { kind: "reservation", field: "reservations", description: "Reservation persistence", availableNow: false },
  { kind: "shipment", field: "shipments", description: "Shipment manifest", availableNow: false },
];

export interface SearchFeedAdapterPlan {
  fields: SearchFeedIndexField[];
  pendingKinds: string[];
  notes: string[];
}

export function describeSearchFeedAdapter(): SearchFeedAdapterPlan {
  const pendingKinds = SEARCH_FEED_INDEX_CONTRACT.filter((f) => !f.availableNow).map((f) => f.kind);
  return {
    fields: SEARCH_FEED_INDEX_CONTRACT,
    pendingKinds,
    notes: [
      "No external search service in this slice.",
      "No indexing job — operational-search remains contract + in-memory lookup.",
      "Email search only when a safe column exists on an already-readable row.",
    ],
  };
}
