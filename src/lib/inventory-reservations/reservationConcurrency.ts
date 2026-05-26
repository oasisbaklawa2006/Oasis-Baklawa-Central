import { ReservationError } from "./reservationTypes";

export function staleVersionMessage(expectedVersion: number): string {
  return `Stale reservation version: expected ${expectedVersion}, no row updated`;
}

export function assertReservationUpdateAffected(count: number | null, expectedVersion: number): void {
  if (count === 1) return;
  throw new ReservationError("stale_version", staleVersionMessage(expectedVersion));
}

export function isReservationTablesMissingError(message: string): boolean {
  const lower = message.toLowerCase();
  return (
    lower.includes("inventory_reservations") &&
    (lower.includes("does not exist") || lower.includes("42p01") || lower.includes("relation"))
  );
}

export function isTestModeAllowInMemoryFallback(): boolean {
  return (
    typeof import.meta !== "undefined" &&
    (import.meta.env?.MODE === "test" || import.meta.env?.VITEST === "true")
  );
}
