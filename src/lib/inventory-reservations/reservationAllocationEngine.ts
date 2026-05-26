import { roundQty } from "./reservationAvailability";
import type { ReservationAllocationRecord } from "./reservationTypes";

export interface AllocationInput {
  inventoryEntityType: string;
  inventoryEntityId: string;
  allocatedQty: number;
}

export function buildAllocationRows(
  reservationId: string,
  inputs: AllocationInput[],
): Omit<ReservationAllocationRecord, "id" | "allocatedAt">[] {
  return inputs.map((a) => ({
    reservationId,
    inventoryEntityType: a.inventoryEntityType,
    inventoryEntityId: a.inventoryEntityId,
    allocatedQty: roundQty(a.allocatedQty),
    allocationStatus: "active",
  }));
}

export function sumActiveAllocations(allocations: ReservationAllocationRecord[]): number {
  return roundQty(
    allocations
      .filter((a) => a.allocationStatus === "active")
      .reduce((n, a) => n + a.allocatedQty, 0),
  );
}
