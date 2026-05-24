import type { CanonicalEntityType } from "./entityTypes";

export type RelationshipCardinality = "one_to_many" | "many_to_one" | "one_to_one" | "many_to_many";

export interface EntityRelationshipDef {
  id: string;
  from: CanonicalEntityType;
  to: CanonicalEntityType;
  label: string;
  cardinality: RelationshipCardinality;
  /** Operational meaning for explorers and docs. */
  description: string;
}

/** Canonical cross-module relationship graph (contract only). */
export const CANONICAL_ENTITY_RELATIONSHIPS: EntityRelationshipDef[] = [
  { id: "rel:order-order_item", from: "order", to: "order_item", label: "contains", cardinality: "one_to_many", description: "Sales order line items" },
  { id: "rel:order_item-carton", from: "order_item", to: "carton", label: "packed_into", cardinality: "many_to_many", description: "Line allocation across cartons" },
  { id: "rel:carton-dispatch", from: "carton", to: "dispatch", label: "assigned_to", cardinality: "many_to_one", description: "Carton on dispatch manifest" },
  { id: "rel:dispatch-shipment", from: "dispatch", to: "shipment", label: "ships_as", cardinality: "one_to_many", description: "Dispatch legs / shipments" },
  { id: "rel:order-approval", from: "order", to: "approval_request", label: "requires", cardinality: "one_to_many", description: "Governance approvals on order" },
  { id: "rel:order-invoice", from: "order", to: "invoice", label: "billed_by", cardinality: "one_to_many", description: "Invoices raised for order" },
  { id: "rel:payment-invoice", from: "payment", to: "invoice", label: "settles", cardinality: "many_to_one", description: "Payment allocation to invoice" },
  { id: "rel:reservation-snapshot", from: "reservation", to: "inventory_snapshot", label: "verified_against", cardinality: "many_to_one", description: "Reservation stock check snapshot" },
  { id: "rel:whatsapp-order", from: "whatsapp_packet", to: "order", label: "context_for", cardinality: "many_to_one", description: "Operator packet linked to order" },
  { id: "rel:media-dispatch", from: "media_document", to: "dispatch", label: "evidence_for", cardinality: "many_to_one", description: "POD / gate media for dispatch" },
  { id: "rel:scan-carton", from: "scan_event", to: "carton", label: "scanned", cardinality: "many_to_one", description: "Barcode scan on carton" },
  { id: "rel:barcode-carton", from: "barcode_label", to: "carton", label: "labels", cardinality: "one_to_one", description: "Printed label on carton" },
  { id: "rel:order-timeline", from: "order", to: "customer_timeline_projection", label: "projects_to", cardinality: "one_to_one", description: "Customer-safe timeline slice" },
  { id: "rel:order-factory_followup", from: "order", to: "factory_followup", label: "tracks", cardinality: "one_to_many", description: "Production follow-ups" },
  { id: "rel:order-notification", from: "order", to: "notification", label: "notifies", cardinality: "one_to_many", description: "Notification intents (no send engine)" },
];

export interface EntityEdge {
  relationshipId: string;
  fromId: string;
  toId: string;
}

export function relationshipsForEntity(type: CanonicalEntityType): EntityRelationshipDef[] {
  return CANONICAL_ENTITY_RELATIONSHIPS.filter((r) => r.from === type || r.to === type);
}

export function outgoingRelationships(type: CanonicalEntityType): EntityRelationshipDef[] {
  return CANONICAL_ENTITY_RELATIONSHIPS.filter((r) => r.from === type);
}

export function incomingRelationships(type: CanonicalEntityType): EntityRelationshipDef[] {
  return CANONICAL_ENTITY_RELATIONSHIPS.filter((r) => r.to === type);
}
