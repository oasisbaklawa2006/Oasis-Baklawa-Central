import type { ReservationLifecycleState } from "@/lib/inventory-operating-system/inventoryTypes";

/** Transitions that require governance approval before code paths may apply them (design list). */
export const PROTECTED_RESERVATION_TRANSITIONS: Array<{ from: ReservationLifecycleState; to: ReservationLifecycleState }> = [
  { from: "pending_approval", to: "approved" },
  { from: "approved", to: "released" },
];
