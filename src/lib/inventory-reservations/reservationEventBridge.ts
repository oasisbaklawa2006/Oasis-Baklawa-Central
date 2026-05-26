import type { ReservationOperationalEventType, ReservationStatus } from "./reservationTypes";
import type { InventoryReservationAction } from "@/lib/inventory-authority/inventoryAuthorityTypes";

export function reservationActionToAuthority(action: string): InventoryReservationAction | null {
  const map: Record<string, InventoryReservationAction> = {
    create: "reservation:create",
    reserve: "reservation:reserve",
    partial_reserve: "reservation:partial_reserve",
    release: "reservation:release",
    expire: "reservation:expire",
    fulfill: "reservation:fulfill",
    cancel: "reservation:cancel",
    override: "reservation:override",
  };
  return map[action] ?? null;
}

export function statusToEventType(status: ReservationStatus, partial: boolean): ReservationOperationalEventType {
  if (status === "reserved" && partial) return "reservation_partially_reserved";
  const map: Partial<Record<ReservationStatus, ReservationOperationalEventType>> = {
    pending: "reservation_created",
    reserved: "reservation_reserved",
    partially_reserved: "reservation_partially_reserved",
    blocked: "reservation_blocked",
    released: "reservation_released",
    expired: "reservation_expired",
    fulfilled: "reservation_fulfilled",
    cancelled: "reservation_cancelled",
  };
  return map[status] ?? "reservation_created";
}

export function movementTypeForTransition(
  from: ReservationStatus,
  to: ReservationStatus,
): "reservation_created" | "reservation_adjusted" | "reservation_released" | "reservation_expired" | "reservation_fulfilled" | "inventory_hold" | "inventory_unhold" {
  if (to === "released") return "reservation_released";
  if (to === "expired") return "reservation_expired";
  if (to === "fulfilled") return "reservation_fulfilled";
  if (to === "cancelled" && from !== "pending") return "reservation_released";
  if (from === "pending" && (to === "reserved" || to === "partially_reserved")) return "inventory_hold";
  return "reservation_adjusted";
}
