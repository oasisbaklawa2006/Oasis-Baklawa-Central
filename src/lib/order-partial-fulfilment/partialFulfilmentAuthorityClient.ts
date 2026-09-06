import {
  POINT76_CORE_PREREQUISITE,
  POINT76_CORE_RPC,
  type PartialFulfilmentActionBlocker,
  type PartialFulfilmentActionResult,
} from "./partialFulfilmentTypes";
import { isCoreRpcAvailable, partialFulfilmentRpc } from "./partialFulfilmentQueries";

function failResult(messages: PartialFulfilmentActionBlocker[]): PartialFulfilmentActionResult {
  return { ok: false, blockers: messages };
}

function formatRpcBlockers(data: unknown): PartialFulfilmentActionBlocker[] {
  if (!data || typeof data !== "object") return [];
  const blockers = (data as { blockers?: PartialFulfilmentActionBlocker[] }).blockers;
  return Array.isArray(blockers) ? blockers : [];
}

async function requireRpc(
  rpcName: string,
  scope: PartialFulfilmentActionBlocker["scope"],
): Promise<PartialFulfilmentActionResult | null> {
  const available = await isCoreRpcAvailable(rpcName);
  if (!available) {
    return failResult([
      {
        code: "CORE_AUTHORITY_ABSENT",
        scope,
        message: `${POINT76_CORE_PREREQUISITE} Missing RPC: ${rpcName}`,
      },
    ]);
  }
  return null;
}

export async function recordProductionPartialFulfilment(params: {
  orderId: string;
  orderItemId: string;
  fulfilledQty: number;
  correlationId: string;
  idempotencyKey: string;
  reason: string;
}): Promise<PartialFulfilmentActionResult> {
  const absent = await requireRpc(POINT76_CORE_RPC.productionPartialFulfilment, "production_split");
  if (absent) return absent;

  const { data, error } = await partialFulfilmentRpc(POINT76_CORE_RPC.productionPartialFulfilment, {
    p_order_id: params.orderId,
    p_order_item_id: params.orderItemId,
    p_fulfilled_qty: params.fulfilledQty,
    p_correlation_id: params.correlationId,
    p_idempotency_key: params.idempotencyKey,
    p_reason: params.reason,
  });

  if (error) throw new Error(error.message);
  const result = data as PartialFulfilmentActionResult & { already_applied?: boolean };
  if (!result?.ok) {
    const blockers = formatRpcBlockers(result);
    return blockers.length
      ? { ok: false, blockers }
      : failResult([
          {
            code: "PRODUCTION_SPLIT_DENIED",
            scope: "production_split",
            message: "Production partial fulfilment denied by Core",
          },
        ]);
  }
  return {
    ok: true,
    alreadyApplied: Boolean(result.already_applied),
    correlationId: params.correlationId,
  };
}

export async function createGovernedDispatchSplitConsignment(params: {
  orderId: string;
  correlationId: string;
  fragmentationOrigin: string;
  fragmentationReason: string;
  destinationSnapshot: Record<string, unknown>;
  dispatchMode: string;
  sequenceNumber: number;
}): Promise<PartialFulfilmentActionResult & { consignmentId?: string }> {
  const absent = await requireRpc(POINT76_CORE_RPC.dispatchSplitConsignment, "dispatch_split");
  if (absent) return absent;

  const { data, error } = await partialFulfilmentRpc(POINT76_CORE_RPC.dispatchSplitConsignment, {
    p_order_id: params.orderId,
    p_correlation_id: params.correlationId,
    p_fragmentation_origin: params.fragmentationOrigin,
    p_fragmentation_reason: params.fragmentationReason,
    p_destination_snapshot: params.destinationSnapshot,
    p_dispatch_mode: params.dispatchMode,
    p_sequence_number: params.sequenceNumber,
  });

  if (error) throw new Error(error.message);
  const row = Array.isArray(data) ? data[0] : data;
  const consignmentId =
    row && typeof row === "object" && "consignment_id" in row
      ? String((row as { consignment_id: string }).consignment_id)
      : undefined;

  return {
    ok: true,
    correlationId: params.correlationId,
    consignmentId,
  };
}

export async function approveRemainderDisposition(params: {
  orderItemId: string;
  approvedClosedQty: number;
  reason: string;
  customerEvidenceRef: string;
  financeAdjustmentRef: string;
  correlationId: string;
  idempotencyKey: string;
}): Promise<PartialFulfilmentActionResult> {
  const absent = await requireRpc(POINT76_CORE_RPC.remainderClosure, "remainder_closure");
  if (absent) return absent;

  const { data, error } = await partialFulfilmentRpc(POINT76_CORE_RPC.remainderClosure, {
    p_order_item_id: params.orderItemId,
    p_approved_closed_qty: params.approvedClosedQty,
    p_reason: params.reason,
    p_customer_evidence_ref: params.customerEvidenceRef,
    p_finance_adjustment_ref: params.financeAdjustmentRef,
    p_correlation_id: params.correlationId,
    p_idempotency_key: params.idempotencyKey,
  });

  if (error) throw new Error(error.message);
  const result = data as PartialFulfilmentActionResult & { already_applied?: boolean };
  if (!result?.ok) {
    const blockers = formatRpcBlockers(result);
    return blockers.length
      ? { ok: false, blockers }
      : failResult([
          {
            code: "REMAINDER_CLOSURE_DENIED",
            scope: "remainder_closure",
            message: "Remainder disposition denied by Core",
          },
        ]);
  }

  return {
    ok: true,
    alreadyApplied: Boolean(result.already_applied),
    correlationId: params.correlationId,
  };
}
