import type { InventoryMovementKind, InventoryMovementProjection } from "./inventoryTypes";

/** Reversal policy per movement kind — architecture only (no DB enforcement here). */
export function movementAllowsReversal(kind: InventoryMovementKind): boolean {
  const noReversal: InventoryMovementKind[] = ["dispatch_extraction", "damage", "expiry"];
  if (noReversal.includes(kind)) return false;
  return true;
}

export function movementRequiresSupervisor(kind: InventoryMovementKind): boolean {
  return kind === "reconciliation" || kind === "reservation_hold" || kind === "dispatch_extraction";
}

export function describeMovementImmutability(m: InventoryMovementProjection): string {
  if (!m.requiresReversalPair) return m.immutabilityNote;
  return `${m.immutabilityNote} Reversal must be a new movement row — never rewrite history.`;
}
