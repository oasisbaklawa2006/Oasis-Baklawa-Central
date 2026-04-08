const ORDER_STATUS_RANK: Record<string, number> = {
  cart: 0,
  draft: 0,
  submitted: 1,
  confirmed: 2,
  approved: 3,
  awaiting_advance: 4,
  in_production: 5,
  manufacturing: 5,
  assembly: 6,
  assembled: 6,
  packing: 7,
  partial_ready: 7,
  packed_ready: 8,
  awaiting_final_payment: 9,
  awaiting_payment: 9,
  cleared_for_dispatch: 10,
  dispatched: 11,
  in_transit: 11,
  delivered: 12,
  closed: 13,
};

export function normalizeOrderStatus(status: string | null | undefined): string {
  const normalized = (status || "").toLowerCase().trim();
  return normalized === "in_production" ? "manufacturing" : normalized;
}

export function isLockedFactoryStatus(status: string | null | undefined): boolean {
  return (ORDER_STATUS_RANK[normalizeOrderStatus(status)] ?? -1) >= ORDER_STATUS_RANK.approved;
}

export function shouldIgnoreOrderRegression(currentStatus: string | null | undefined, nextStatus: string | null | undefined): boolean {
  const current = normalizeOrderStatus(currentStatus);
  const next = normalizeOrderStatus(nextStatus);

  if (!current || !next) return false;
  if (!isLockedFactoryStatus(current)) return false;
  if (next === "draft" || next === "cart") return true;

  return (ORDER_STATUS_RANK[next] ?? -1) < (ORDER_STATUS_RANK[current] ?? -1);
}