export type InventoryReservationAction =
  | "reservation:create"
  | "reservation:reserve"
  | "reservation:partial_reserve"
  | "reservation:release"
  | "reservation:expire"
  | "reservation:fulfill"
  | "reservation:cancel"
  | "reservation:override";

export interface InventoryAuthorityContext {
  actorRole: string;
  actorUserId: string;
  actorDepartment?: string | null;
  overrideReason?: string | null;
}

export interface InventoryAuthorityDecision {
  allowed: boolean;
  reason: string;
}
