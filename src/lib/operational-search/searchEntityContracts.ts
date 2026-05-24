import type { CanonicalEntityType } from "@/lib/entity-graph/entityTypes";

export type OperationalSearchKind =
  | "so_number"
  | "uuid"
  | "barcode"
  | "carton"
  | "phone"
  | "whatsapp_packet"
  | "reservation"
  | "dispatch"
  | "invoice"
  | "shipment"
  | "customer";

export interface OperationalSearchHit {
  kind: OperationalSearchKind;
  query: string;
  entityType: CanonicalEntityType;
  entityId: string;
  label: string;
  /** Group for explorer UI. */
  group: string;
}

export interface OperationalSearchQuery {
  text: string;
  kinds?: OperationalSearchKind[];
  limit?: number;
}

export interface OperationalSearchResult {
  hits: OperationalSearchHit[];
  pendingKinds: OperationalSearchKind[];
  generatedAt: string;
}

export const SEARCH_KIND_LABELS: Record<OperationalSearchKind, string> = {
  so_number: "Sales order",
  uuid: "UUID",
  barcode: "Barcode",
  carton: "Carton",
  phone: "Phone",
  whatsapp_packet: "WhatsApp packet",
  reservation: "Reservation",
  dispatch: "Dispatch",
  invoice: "Invoice",
  shipment: "Shipment",
  customer: "Customer",
};
