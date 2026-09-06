import { supabase } from "@/integrations/supabase/client";
import { projectOrderPriorityOwnerSlaFacts } from "./orderPriorityOwnerSlaProjection";
import type { OrderPriorityOwnerSlaFacts, OrderPriorityOwnerSlaRawFacts } from "./orderPriorityOwnerSlaTypes";

type RpcResult = { data: unknown; error: { message: string } | null };

type RpcClient = {
  rpc: (fn: string, args?: Record<string, unknown>) => Promise<RpcResult>;
};

function rpc(fn: string, args?: Record<string, unknown>): Promise<RpcResult> {
  const client = supabase as unknown as RpcClient;
  return client.rpc.call(supabase, fn, args);
}

type CommercialFactRow = {
  order_id: string;
  promised_dispatch_date: string | null;
  requested_dispatch_date: string | null;
};

type OrderRow = {
  id: string;
  order_number?: string | null;
  status: string | null;
  created_at: string | null;
  dispatch_urgency: string | null;
  requested_dispatch_date: string | null;
  admin_promised_date: string | null;
  estimated_despatch_date: string | null;
  system_estimated_date: string | null;
  wamid: string | null;
  company_id: string | null;
};

type DraftRow = {
  promoted_order_id: string | null;
  order_handler_id: string | null;
  order_handler_name: string | null;
  client_owner_id: string | null;
  client_owner_name: string | null;
};

type CompanyRow = {
  id: string;
  account_manager_id: string | null;
};

const ORDER_SELECT =
  "id, order_number, status, created_at, dispatch_urgency, requested_dispatch_date, admin_promised_date, estimated_despatch_date, system_estimated_date, wamid, company_id";

async function loadCommercialFactsByOrderId(
  orderIds: string[],
): Promise<Map<string, CommercialFactRow>> {
  const map = new Map<string, CommercialFactRow>();
  if (orderIds.length === 0) return map;

  const { data, error } = await rpc("customer_sales_order_commercial_facts_v1");
  if (error || !Array.isArray(data)) return map;

  const wanted = new Set(orderIds);
  for (const row of data as CommercialFactRow[]) {
    if (wanted.has(row.order_id)) map.set(row.order_id, row);
  }
  return map;
}

function toRawFacts(
  order: OrderRow,
  commercial: CommercialFactRow | undefined,
  draft: DraftRow | undefined,
  accountManagerId: string | null | undefined,
): OrderPriorityOwnerSlaRawFacts {
  return {
    orderId: order.id,
    orderNumber: order.order_number,
    status: order.status,
    createdAt: order.created_at,
    dispatchUrgency: order.dispatch_urgency,
    requestedDispatchDate: order.requested_dispatch_date,
    adminPromisedDate: order.admin_promised_date,
    estimatedDespatchDate: order.estimated_despatch_date,
    systemEstimatedDate: order.system_estimated_date,
    commercialPromisedDispatchDate: commercial?.promised_dispatch_date ?? null,
    commercialRequestedDispatchDate: commercial?.requested_dispatch_date ?? null,
    wamid: order.wamid,
    draftOrderHandlerId: draft?.order_handler_id ?? null,
    draftOrderHandlerName: draft?.order_handler_name ?? null,
    draftClientOwnerId: draft?.client_owner_id ?? null,
    draftClientOwnerName: draft?.client_owner_name ?? null,
    accountManagerId: accountManagerId ?? null,
  };
}

export async function fetchOrderPriorityOwnerSlaFacts(
  orderId: string,
  nowIso = new Date().toISOString(),
): Promise<OrderPriorityOwnerSlaFacts> {
  const batch = await fetchOrderPriorityOwnerSlaFactsBatch([orderId], nowIso);
  const facts = batch.get(orderId);
  if (!facts) {
    throw new Error(`Order ${orderId} not found for Point74 priority/owner/SLA projection`);
  }
  return facts;
}

export async function fetchOrderPriorityOwnerSlaFactsBatch(
  orderIds: string[],
  nowIso = new Date().toISOString(),
): Promise<Map<string, OrderPriorityOwnerSlaFacts>> {
  const uniqueIds = [...new Set(orderIds.filter(Boolean))];
  const out = new Map<string, OrderPriorityOwnerSlaFacts>();
  if (uniqueIds.length === 0) return out;

  const [ordersRes, commercialByOrderId] = await Promise.all([
    supabase.from("orders").select(ORDER_SELECT).in("id", uniqueIds),
    loadCommercialFactsByOrderId(uniqueIds),
  ]);

  if (ordersRes.error) throw new Error(ordersRes.error.message);
  const orders = (ordersRes.data ?? []) as OrderRow[];

  const companyIds = [...new Set(orders.map((o) => o.company_id).filter(Boolean))] as string[];
  let accountManagerByCompanyId = new Map<string, string | null>();
  if (companyIds.length) {
    const { data: companies, error } = await supabase
      .from("companies")
      .select("id, account_manager_id")
      .in("id", companyIds);
    if (error) throw new Error(error.message);
    accountManagerByCompanyId = new Map(
      ((companies ?? []) as CompanyRow[]).map((c) => [c.id, c.account_manager_id]),
    );
  }

  let draftByPromotedOrderId = new Map<string, DraftRow>();
  const { data: drafts, error: draftError } = await supabase
    .from("sales_order_drafts")
    .select(
      "promoted_order_id, order_handler_id, order_handler_name, client_owner_id, client_owner_name",
    )
    .in("promoted_order_id", uniqueIds);
  if (draftError) throw new Error(draftError.message);
  for (const draft of (drafts ?? []) as DraftRow[]) {
    if (draft.promoted_order_id) draftByPromotedOrderId.set(draft.promoted_order_id, draft);
  }

  for (const order of orders) {
    const raw = toRawFacts(
      order,
      commercialByOrderId.get(order.id),
      draftByPromotedOrderId.get(order.id),
      order.company_id ? accountManagerByCompanyId.get(order.company_id) : null,
    );
    out.set(order.id, projectOrderPriorityOwnerSlaFacts(raw, nowIso, nowIso));
  }

  return out;
}

/** Pure projection entry for tests and offline adapters. */
export function projectFromRawFacts(
  raw: OrderPriorityOwnerSlaRawFacts,
  nowIso = new Date().toISOString(),
): OrderPriorityOwnerSlaFacts {
  return projectOrderPriorityOwnerSlaFacts(raw, nowIso, nowIso);
}
