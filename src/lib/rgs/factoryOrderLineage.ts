/**
 * Factory RGS line attribution uses the original order_items.id rather than
 * order_id+product_id. Multiple SO lines can carry the same product.
 * Existing unlabelled historical reservations must be reconciled, not guessed.
 * This is read-only linkage; Core RPCs remain the sole stock authority.
 */
export const factoryOrderLineReference = (orderItemId: string): string =>
  `order_item:${orderItemId}`;

export type FactoryLineReservation = {
  id: string;
  order_id: string | null;
  product_id: string | null;
  demand_reference: string | null;
};

export function resolveFactoryLineReservations<T extends FactoryLineReservation>(
  line: { id: string; order_id: string; product_id: string | null },
  reservations: T[],
): { matched: T[]; ambiguousLegacy: boolean } {
  const reference = factoryOrderLineReference(line.id);
  const sameSku = reservations.filter(
    (item) => item.order_id === line.order_id && item.product_id != null && item.product_id === line.product_id,
  );
  return {
    matched: sameSku.filter((item) => item.demand_reference === reference),
    ambiguousLegacy: sameSku.some((item) =>
      !item.demand_reference || !item.demand_reference.startsWith("order_item:")),
  };
}

export function isFactoryJobForLine(
  job: { order_item_id: string | null; reservation_id: string | null },
  lineId: string,
  lineReservationIds: Set<string>,
): boolean {
  return job.order_item_id === lineId ||
    (!!job.reservation_id && lineReservationIds.has(job.reservation_id));
}
