import type { ReservationPriority } from "./reservationTypes";

const PRIORITY_RANK: Record<ReservationPriority, number> = {
  urgent: 4,
  high: 3,
  normal: 2,
  low: 1,
};

export function compareReservationPriority(a: ReservationPriority, b: ReservationPriority): number {
  return PRIORITY_RANK[b] - PRIORITY_RANK[a];
}

export function defaultExpiryForPriority(priority: ReservationPriority, fromIso: string): string {
  const hours =
    priority === "urgent" ? 4 : priority === "high" ? 12 : priority === "normal" ? 48 : 72;
  const d = new Date(fromIso);
  d.setHours(d.getHours() + hours);
  return d.toISOString();
}
