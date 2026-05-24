/**
 * Canonical operational entity types — pure contracts, no persistence.
 */

export const CANONICAL_ENTITY_TYPES = [
  "order",
  "order_item",
  "reservation",
  "carton",
  "dispatch",
  "shipment",
  "invoice",
  "payment",
  "approval_request",
  "factory_followup",
  "inventory_snapshot",
  "scan_event",
  "barcode_label",
  "whatsapp_packet",
  "notification",
  "media_document",
  "customer_timeline_projection",
] as const;

export type CanonicalEntityType = (typeof CANONICAL_ENTITY_TYPES)[number];

export interface EntityRef {
  type: CanonicalEntityType;
  id: string;
  /** Human-facing key when known (SO number, barcode, etc.). */
  displayKey?: string;
}

export interface OperationalEntityNode {
  ref: EntityRef;
  label: string;
  /** ISO timestamp when entity was last observed in a projection input. */
  observedAt?: string;
  /** Module that originated this node in the projection (traceability only). */
  sourceModule?: string;
  metadata?: Record<string, string | number | boolean | null>;
}

export interface EntityGraphSnapshot {
  nodes: OperationalEntityNode[];
  generatedAt: string;
}

export function entityRef(type: CanonicalEntityType, id: string, displayKey?: string): EntityRef {
  return { type, id, displayKey };
}

export function isCanonicalEntityType(value: string): value is CanonicalEntityType {
  return (CANONICAL_ENTITY_TYPES as readonly string[]).includes(value);
}
