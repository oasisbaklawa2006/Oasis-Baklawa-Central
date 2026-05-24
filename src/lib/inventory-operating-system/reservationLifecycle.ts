import type { ReservationLifecycleState } from "./inventoryTypes";

export const RESERVATION_VALID_NEXT: Record<ReservationLifecycleState, ReservationLifecycleState[]> = {
  draft: ["verification_required", "cancelled"],
  verification_required: ["pending_approval", "draft", "cancelled"],
  pending_approval: ["approved", "cancelled", "verification_required"],
  approved: ["released", "expired", "cancelled"],
  released: [],
  expired: [],
  cancelled: [],
};

export function isReservationTransitionValid(from: ReservationLifecycleState, to: ReservationLifecycleState): boolean {
  return RESERVATION_VALID_NEXT[from]?.includes(to) ?? false;
}

export function reservationRequiresLocking(state: ReservationLifecycleState): boolean {
  return state === "approved" || state === "pending_approval";
}
