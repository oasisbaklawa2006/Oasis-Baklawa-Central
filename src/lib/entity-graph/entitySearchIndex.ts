import type { CanonicalEntityType } from "./entityTypes";

export type EntitySearchKeyKind =
  | "uuid"
  | "so_number"
  | "barcode"
  | "carton_id"
  | "phone"
  | "whatsapp_packet_id"
  | "reservation_id"
  | "dispatch_id"
  | "invoice_id"
  | "shipment_id"
  | "customer_id";

export interface EntitySearchIndexEntry {
  kind: EntitySearchKeyKind;
  value: string;
  resolvedType: CanonicalEntityType;
  entityId: string;
  /** Display label for unified search UI. */
  label: string;
}

/** Contract for in-memory search index entries — no persistence or network. */
export interface EntitySearchIndexSnapshot {
  entries: EntitySearchIndexEntry[];
  builtAt: string;
}

export function buildSearchIndexEntry(
  kind: EntitySearchKeyKind,
  value: string,
  resolvedType: CanonicalEntityType,
  entityId: string,
  label: string,
): EntitySearchIndexEntry {
  return { kind, value: value.trim(), resolvedType, entityId, label };
}

export function lookupInIndex(
  snapshot: EntitySearchIndexSnapshot,
  query: string,
): EntitySearchIndexEntry[] {
  const q = query.trim().toLowerCase();
  if (!q) return [];
  return snapshot.entries.filter(
    (e) => e.value.toLowerCase().includes(q) || e.label.toLowerCase().includes(q) || e.entityId.toLowerCase() === q,
  );
}
