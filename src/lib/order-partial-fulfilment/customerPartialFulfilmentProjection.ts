import type { PartialFulfilmentOrderProjection } from "./partialFulfilmentTypes";

export type CustomerPartialFulfilmentCode =
  | "PREPARING"
  | "PARTIALLY_READY"
  | "PARTIALLY_DISPATCHED"
  | "PARTIALLY_DELIVERED"
  | "ACTION_REQUIRED"
  | "ON_HOLD";

export interface CustomerPartialLineProjection {
  orderItemId: string;
  orderedQty: number;
  readyQty: number;
  dispatchedQty: number;
  deliveredQty: number;
  pendingBalanceQty: number;
  customerLabel: string;
}

export interface CustomerPartialFulfilmentProjection {
  orderId: string;
  headlineStatus: CustomerPartialFulfilmentCode;
  headlineLabel: string;
  lines: CustomerPartialLineProjection[];
  /** Never claim full dispatch/delivery when splits remain open. */
  suppressesWholeOrderDispatched: boolean;
  suppressesWholeOrderDelivered: boolean;
}

function lineLabel(line: CustomerPartialLineProjection): string {
  if (line.deliveredQty > 0 && line.deliveredQty < line.orderedQty) {
    return "Part of this line has been delivered";
  }
  if (line.dispatchedQty > 0 && line.dispatchedQty < line.orderedQty) {
    return "Part of this line has been dispatched";
  }
  if (line.readyQty > 0 && line.readyQty < line.orderedQty) {
    return "Part of this line is ready";
  }
  return "Your order is being prepared";
}

export function projectCustomerPartialFulfilment(
  projection: PartialFulfilmentOrderProjection,
): CustomerPartialFulfilmentProjection {
  const lines: CustomerPartialLineProjection[] = projection.lines.map((l) => {
    const readyQty = Math.max(l.packedQty, l.fulfilledQty);
    const pendingBalanceQty = Math.max(0, l.orderedQty - l.cancelledQty - l.dispatchedQty - l.approvedClosedQty);
    return {
      orderItemId: l.orderItemId,
      orderedQty: l.orderedQty,
      readyQty,
      dispatchedQty: l.dispatchedQty,
      deliveredQty: l.deliveredQty,
      pendingBalanceQty,
      customerLabel: lineLabel({
        orderItemId: l.orderItemId,
        orderedQty: l.orderedQty,
        readyQty,
        dispatchedQty: l.dispatchedQty,
        deliveredQty: l.deliveredQty,
        pendingBalanceQty,
        customerLabel: "",
      }),
    };
  });

  const anyDeliveredPartial = lines.some(
    (l) => l.deliveredQty > 0 && l.deliveredQty < l.orderedQty,
  );
  const anyDispatchedPartial = lines.some(
    (l) => l.dispatchedQty > 0 && l.dispatchedQty < l.orderedQty,
  );
  const anyReadyPartial = lines.some((l) => l.readyQty > 0 && l.readyQty < l.orderedQty);
  const needsAction = projection.lines.some((l) => l.remainderDisposition === "pending_customer");

  let headlineStatus: CustomerPartialFulfilmentCode = "PREPARING";
  let headlineLabel = "Your order is being prepared";

  if (needsAction) {
    headlineStatus = "ACTION_REQUIRED";
    headlineLabel = "We need your confirmation before we can complete the remaining quantity";
  } else if (anyDeliveredPartial) {
    headlineStatus = "PARTIALLY_DELIVERED";
    headlineLabel = "Part of your order has been delivered";
  } else if (anyDispatchedPartial) {
    headlineStatus = "PARTIALLY_DISPATCHED";
    headlineLabel = "Part of your order has been dispatched";
  } else if (anyReadyPartial || projection.hasPartialFulfilment) {
    headlineStatus = "PARTIALLY_READY";
    headlineLabel = "Part of your order is ready";
  }

  const suppressesWholeOrderDispatched =
    projection.hasPartialFulfilment || projection.hasOpenRemainder || projection.hasSplitConsignments;
  const suppressesWholeOrderDelivered = anyDeliveredPartial || suppressesWholeOrderDispatched;

  return {
    orderId: projection.orderId,
    headlineStatus,
    headlineLabel,
    lines,
    suppressesWholeOrderDispatched,
    suppressesWholeOrderDelivered,
  };
}
