import { supabase } from "@/integrations/supabase/client";
import type {
  ConsignmentSplitFact,
  DispatchLineFact,
  PartialFulfilmentLineInput,
  ResidualClosureFact,
  ReservationLineFact,
} from "./partialFulfilmentTypes";
import { projectPartialFulfilmentOrder } from "./partialFulfilmentProjection";

type RpcClient = {
  rpc: (fn: string, args?: Record<string, unknown>) => Promise<{ data: unknown; error: { message: string } | null }>;
};

function rpc(fn: string, args?: Record<string, unknown>) {
  const client = supabase as unknown as RpcClient;
  return client.rpc.call(supabase, fn, args);
}

export async function loadPartialFulfilmentFacts(orderId: string) {
  const itemsRes = await supabase
    .from("order_items")
    .select("id, product_id, quantity, actual_packed_qty, production_status")
    .eq("order_id", orderId);

  if (itemsRes.error) throw new Error(itemsRes.error.message);

  const orderItemIds = (itemsRes.data ?? []).map((r) => r.id);

  const [dispatchLinesRes, reservationsRes, residualClosuresRes, consignmentsRes] = await Promise.all([
    supabase.from("b2b_dispatch_so_line_fulfilment").select("*").eq("order_id", orderId),
    supabase
      .from("inventory_reservations")
      .select("id, product_id, requested_qty, reserved_qty, fulfilled_qty, released_qty, reservation_status")
      .eq("order_id", orderId),
    orderItemIds.length
      ? supabase
          .from("b2b_dispatch_residual_closures")
          .select("id, order_item_id, approved_closed_qty, reason, correlation_id")
          .in("order_item_id", orderItemIds)
      : Promise.resolve({ data: [], error: null }),
    supabase
      .from("b2b_dispatch_consignments")
      .select(
        "id, consignment_number, sequence_number, status, fragmentation_origin, fragmentation_reason, b2b_dispatch_consignment_lines(order_item_id, selected_qty)",
      )
      .eq("order_id", orderId),
  ]);

  const dispatchByItem = new Map<string, DispatchLineFact>();
  for (const row of dispatchLinesRes.data ?? []) {
    if (!row.order_item_id) continue;
    dispatchByItem.set(row.order_item_id, {
      orderItemId: row.order_item_id,
      productId: row.product_id,
      originalOrderQty: Number(row.original_order_qty ?? 0),
      cumulativeDispatchedQty: Number(row.cumulative_dispatched_qty ?? 0),
      residualQty: Number(row.residual_qty ?? 0),
      approvedClosedQty: Number(row.approved_closed_qty ?? 0),
    });
  }

  const reservationsByProduct = new Map<string, ReservationLineFact[]>();
  for (const row of reservationsRes.data ?? []) {
    const fact: ReservationLineFact = {
      reservationId: row.id,
      requestedQty: Number(row.requested_qty ?? 0),
      reservedQty: Number(row.reserved_qty ?? 0),
      fulfilledQty: Number(row.fulfilled_qty ?? 0),
      releasedQty: Number(row.released_qty ?? 0),
      reservationStatus: row.reservation_status ?? "unknown",
    };
    const key = row.product_id ?? row.id;
    const list = reservationsByProduct.get(key) ?? [];
    list.push(fact);
    reservationsByProduct.set(key, list);
  }

  const closuresByItem = new Map<string, ResidualClosureFact[]>();
  for (const row of residualClosuresRes.data ?? []) {
    const fact: ResidualClosureFact = {
      closureId: row.id,
      orderItemId: row.order_item_id,
      approvedClosedQty: Number(row.approved_closed_qty ?? 0),
      reason: row.reason,
      correlationId: row.correlation_id,
    };
    const list = closuresByItem.get(row.order_item_id) ?? [];
    list.push(fact);
    closuresByItem.set(row.order_item_id, list);
  }

  const consignmentSplitsByItem = new Map<string, ConsignmentSplitFact[]>();
  for (const consignment of consignmentsRes.data ?? []) {
    const lines = (consignment.b2b_dispatch_consignment_lines ?? []) as {
      order_item_id: string;
      selected_qty: number;
    }[];
    for (const line of lines) {
      const fact: ConsignmentSplitFact = {
        consignmentId: consignment.id,
        consignmentNumber: consignment.consignment_number,
        sequenceNumber: consignment.sequence_number,
        status: consignment.status,
        fragmentationOrigin: consignment.fragmentation_origin,
        fragmentationReason: consignment.fragmentation_reason,
        lineSelectedQty: Number(line.selected_qty ?? 0),
      };
      const list = consignmentSplitsByItem.get(line.order_item_id) ?? [];
      list.push(fact);
      consignmentSplitsByItem.set(line.order_item_id, list);
    }
  }

  const lineInputs: PartialFulfilmentLineInput[] = (itemsRes.data ?? []).map((item) => ({
    orderItemId: item.id,
    productId: item.product_id,
    orderedQty: Number(item.quantity ?? 0),
    packedQty: Number(item.actual_packed_qty ?? 0),
    productionStatus: item.production_status,
    dispatchLine: dispatchByItem.get(item.id) ?? null,
    reservations: reservationsByProduct.get(item.product_id ?? item.id) ?? [],
    residualClosures: closuresByItem.get(item.id) ?? [],
    consignmentSplits: consignmentSplitsByItem.get(item.id) ?? [],
  }));

  return projectPartialFulfilmentOrder({ orderId, lines: lineInputs });
}

/** Probe whether a Core RPC is deployed — used to fail closed before mutation attempts. */
export async function isCoreRpcAvailable(functionName: string): Promise<boolean> {
  const { error } = await rpc(functionName, { __probe_only: true });
  if (!error) return true;
  const msg = error.message.toLowerCase();
  if (msg.includes("could not find the function") || msg.includes("does not exist")) return false;
  // Any other error (validation/permission) means the function exists.
  return true;
}

export { rpc as partialFulfilmentRpc };
