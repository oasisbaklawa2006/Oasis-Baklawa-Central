/**
 * Point92 — Central packing/carton/DPL surface classification.
 *
 * Mutations are permitted only on DispatchManagement via governed Core RPCs.
 * CartonExplorer, ScanTimeline and DispatchTV are read-only observability surfaces.
 */

/** Sole Central surface authorized to mutate B2B carton/DPL state (FACT-C3). */
export const PACKING_MUTATION_SURFACE = "DispatchManagement";

/** Read-only surfaces — SELECT on governed relations only; no RPC mutations. */
export const PACKING_READ_ONLY_SURFACES = ["CartonExplorer", "ScanTimeline", "DispatchTV"] as const;

export type PackingReadOnlySurface = (typeof PACKING_READ_ONLY_SURFACES)[number];

/** Governed RPCs that constitute the canonical packing/carton/DPL mutation chain. */
export const GOVERNED_PACKING_CARTON_DPL_RPCS = [
  "create_b2b_dispatch_consignment",
  "open_b2b_dispatch_carton",
  "record_b2b_dispatch_carton_item_scan",
  "record_b2b_dispatch_carton_evidence",
  "lock_b2b_dispatch_carton",
  "create_b2b_dispatch_packing_list",
  "supersede_b2b_dispatch_packing_list",
  "submit_b2b_dispatch_packing_list_to_finance",
] as const;

/** Relations that hold authoritative carton/DPL truth (Core-governed). */
export const AUTHORITATIVE_PACKING_RELATIONS = [
  "b2b_dispatch_cartons",
  "b2b_dispatch_carton_items",
  "b2b_dispatch_packing_list_versions",
  "b2b_dispatch_consignment_lines",
  "b2b_dispatch_product_scan_events",
] as const;

/** Legacy relations that must not receive client writes for the B2B order universe. */
export const LEGACY_PACKING_RELATIONS_BLOCKED = [
  "dispatch_cartons",
  "packing_lists",
  "dispatches",
] as const;

export function isPackingReadOnlySurface(surface: string): boolean {
  return (PACKING_READ_ONLY_SURFACES as readonly string[]).includes(surface);
}
