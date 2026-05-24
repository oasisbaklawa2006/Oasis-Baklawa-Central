import type { InventoryMovementProjection } from "./inventoryTypes";

export interface InventoryTimelineEntry {
  id: string;
  label: string;
  detail: string;
  /** Always null in foundation — no fabricated event clocks. */
  occurredAt: null;
}

/**
 * Builds a read-only timeline strip from movement projections (metadata ordering only).
 */
export function buildInventoryMovementTimeline(movements: InventoryMovementProjection[]): InventoryTimelineEntry[] {
  return movements.map((m, i) => ({
    id: `inv-timeline:${m.id}:${i}`,
    label: m.kind.replace(/_/g, " "),
    detail: `${m.qtyDisplay} · ${m.immutabilityNote}`,
    occurredAt: null,
  }));
}
