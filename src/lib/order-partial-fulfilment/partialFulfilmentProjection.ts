import type {
  PartialFulfilmentLineInput,
  PartialFulfilmentLineProjection,
  PartialFulfilmentOrderProjection,
  PartialFulfilmentAuthorityState,
  RemainderDisposition,
} from "./partialFulfilmentTypes";

function n(value: number | null | undefined): number {
  const v = Number(value);
  return Number.isFinite(v) ? Math.max(0, v) : 0;
}

function deriveRemainderDisposition(input: {
  remainderQty: number;
  approvedClosedQty: number;
  cancelledQty: number;
  openConsignmentCount: number;
}): RemainderDisposition {
  if (input.cancelledQty > 0 && input.remainderQty <= 0) return "cancelled";
  if (input.approvedClosedQty > 0 && input.remainderQty <= 0) return "approved_closed";
  if (input.remainderQty <= 0) return "open";
  if (input.openConsignmentCount > 0) return "pending_customer";
  return "open";
}

export function projectPartialFulfilmentLine(
  input: PartialFulfilmentLineInput,
): PartialFulfilmentLineProjection {
  const orderedQty = n(input.orderedQty);
  const packedQty = n(input.packedQty);
  const cancelledQty = n(input.cancelledQty);

  const reservationFulfilled = input.reservations.reduce((sum, r) => sum + n(r.fulfilledQty), 0);
  const dispatch = input.dispatchLine;
  const dispatchedQty = dispatch ? n(dispatch.cumulativeDispatchedQty) : 0;
  const approvedClosedFromDispatch = dispatch ? n(dispatch.approvedClosedQty) : 0;
  const approvedClosedFromClosures = input.residualClosures.reduce(
    (sum, c) => sum + n(c.approvedClosedQty),
    0,
  );
  const approvedClosedQty = Math.max(approvedClosedFromDispatch, approvedClosedFromClosures);

  const fulfilledQty = Math.max(reservationFulfilled, packedQty, dispatchedQty);
  const deliveredQty = input.consignmentSplits
    .filter((c) => ["delivered", "completed", "closed"].includes((c.status || "").toLowerCase()))
    .reduce((sum, c) => sum + n(c.lineSelectedQty), 0);

  const openConsignmentCount = input.consignmentSplits.filter((c) =>
    ["draft", "open", "packing", "ready", "in_progress", "loading"].includes(
      (c.status || "").toLowerCase(),
    ),
  ).length;

  let remainderQty: number;
  const conservationViolations: string[] = [];

  if (dispatch) {
    const coreOriginal = n(dispatch.originalOrderQty);
    const coreResidual = n(dispatch.residualQty);
    const coreDispatched = n(dispatch.cumulativeDispatchedQty);

    if (coreOriginal !== orderedQty && coreOriginal > 0) {
      conservationViolations.push(
        `dispatch original_order_qty (${coreOriginal}) diverges from canonical order_items.quantity (${orderedQty})`,
      );
    }

    if (coreOriginal !== coreDispatched + coreResidual) {
      conservationViolations.push(
        `dispatch line conservation failed: original (${coreOriginal}) != dispatched (${coreDispatched}) + residual (${coreResidual})`,
      );
    }

    remainderQty = coreResidual;
  } else {
    remainderQty = Math.max(0, orderedQty - fulfilledQty - cancelledQty - approvedClosedQty);
    if (dispatchedQty > orderedQty) {
      conservationViolations.push(
        `dispatched quantity (${dispatchedQty}) exceeds ordered quantity (${orderedQty}) without dispatch authority facts`,
      );
    }
  }

  if (packedQty > orderedQty) {
    conservationViolations.push(`packed (${packedQty}) exceeds ordered (${orderedQty})`);
  }
  if (dispatchedQty > packedQty && packedQty > 0) {
    conservationViolations.push(`dispatched (${dispatchedQty}) exceeds packed (${packedQty})`);
  }
  if (fulfilledQty + cancelledQty + approvedClosedQty + remainderQty > orderedQty + 0.0001) {
    conservationViolations.push(
      `line buckets exceed ordered: fulfilled(${fulfilledQty}) + cancelled(${cancelledQty}) + closed(${approvedClosedQty}) + remainder(${remainderQty}) > ordered(${orderedQty})`,
    );
  }

  const remainderDisposition = deriveRemainderDisposition({
    remainderQty,
    approvedClosedQty,
    cancelledQty,
    openConsignmentCount,
  });

  return {
    orderItemId: input.orderItemId,
    productId: input.productId,
    orderedQty,
    confirmedQty: orderedQty - cancelledQty,
    cancelledQty,
    fulfilledQty,
    packedQty,
    dispatchedQty,
    deliveredQty,
    approvedClosedQty,
    remainderQty,
    remainderDisposition,
    openConsignmentCount,
    quantityConserved: conservationViolations.length === 0,
    conservationViolations,
  };
}

export function derivePartialFulfilmentAuthorityState(
  lines: PartialFulfilmentLineInput[],
): PartialFulfilmentAuthorityState {
  const hasDispatchFacts = lines.some((l) => Boolean(l.dispatchLine));
  if (hasDispatchFacts) return "dispatch_line_facts_available";
  return "dispatch_authority_absent";
}

export function buildPartialFulfilmentReplayKey(
  orderId: string,
  lines: PartialFulfilmentLineProjection[],
): string {
  const payload = lines
    .map(
      (l) =>
        `${l.orderItemId}:${l.orderedQty}:${l.fulfilledQty}:${l.packedQty}:${l.dispatchedQty}:${l.remainderQty}:${l.approvedClosedQty}`,
    )
    .sort()
    .join("|");
  return `${orderId}::${payload}`;
}

export function projectPartialFulfilmentOrder(params: {
  orderId: string;
  lines: PartialFulfilmentLineInput[];
  evaluatedAt?: string;
}): PartialFulfilmentOrderProjection {
  const projectedLines = params.lines.map(projectPartialFulfilmentLine);
  const authorityState = derivePartialFulfilmentAuthorityState(params.lines);
  const conservationViolations = projectedLines.flatMap((l) => l.conservationViolations);

  const hasPartialFulfilment = projectedLines.some(
    (l) =>
      l.dispatchedQty > 0 &&
      l.dispatchedQty < l.orderedQty - l.cancelledQty - l.approvedClosedQty,
  );
  const hasOpenRemainder = projectedLines.some((l) => l.remainderQty > 0);
  const hasSplitConsignments = params.lines.some((l) => l.consignmentSplits.length > 1);

  return {
    orderId: params.orderId,
    authorityState,
    lines: projectedLines,
    hasPartialFulfilment,
    hasOpenRemainder,
    hasSplitConsignments,
    quantityConserved: conservationViolations.length === 0,
    conservationViolations,
    replayKey: buildPartialFulfilmentReplayKey(params.orderId, projectedLines),
    evaluatedAt: params.evaluatedAt ?? new Date().toISOString(),
  };
}

/** Idempotent replay: identical facts must yield an identical replay key. */
export function assertPartialFulfilmentReplayStable(
  first: PartialFulfilmentOrderProjection,
  second: PartialFulfilmentOrderProjection,
): boolean {
  return first.replayKey === second.replayKey;
}
