export type InventoryReservationAction =
  | "reservation:create"
  | "reservation:reserve"
  | "reservation:partial_reserve"
  | "reservation:release"
  | "reservation:expire"
  | "reservation:fulfill"
  | "reservation:cancel"
  | "reservation:override";

/** `golden_chain_operator` — governed wizard path after dispatch finalize (24D/24I). */
export type InventoryReservationWriteChannel = "reservation_board" | "golden_chain_operator";

export interface InventoryAuthorityContext {
  actorRole: string;
  actorUserId: string;
  actorDepartment?: string | null;
  overrideReason?: string | null;
  writeChannel?: InventoryReservationWriteChannel;
}

export interface InventoryAuthorityDecision {
  allowed: boolean;
  reason: string;
}
