/**
 * Governance hooks for inventory OS — static authority matrix (no live ACL enforcement).
 */

export type InventoryGovernanceAction =
  | "apply_reservation_hold"
  | "release_reservation_hold"
  | "post_reconciliation"
  | "void_movement"
  | "override_dispatch_block";

export type InventoryRole = "store_operator" | "inventory_controller" | "finance_head" | "cmd" | "super_admin";

const MATRIX: Record<InventoryGovernanceAction, InventoryRole[]> = {
  apply_reservation_hold: ["inventory_controller", "cmd", "super_admin"],
  release_reservation_hold: ["inventory_controller", "finance_head", "cmd", "super_admin"],
  post_reconciliation: ["inventory_controller", "cmd", "super_admin"],
  void_movement: ["cmd", "super_admin"],
  override_dispatch_block: ["finance_head", "cmd", "super_admin"],
};

export function rolesAllowedForInventoryAction(action: InventoryGovernanceAction): InventoryRole[] {
  return [...MATRIX[action]];
}

export function canRolePerform(role: InventoryRole, action: InventoryGovernanceAction): boolean {
  return MATRIX[action].includes(role);
}
