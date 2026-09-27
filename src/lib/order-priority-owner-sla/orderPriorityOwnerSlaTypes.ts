/** Original Point74 (#459) — order priority / owner / SLA. Not CRM-lite #444/#449. */

export const POINT74_CORE_PREREQUISITES = {
  staffSalesOrderPriorityOwnerSlaFactsV1: "staff_sales_order_priority_owner_sla_facts_v1",
  reassignOrderOwnerV1: "reassign_order_owner_v1",
  overrideOrderPriorityV1: "override_order_priority_v1",
  staffSalesOrderCommercialFactsV1: "staff_sales_order_commercial_facts_v1",
} as const;

export type OrderPriorityBand = "panic" | "standard" | "unknown";

export type OrderPriorityProvenance = "orders_dispatch_urgency";

export type SlaDateProvenance =
  | "core_commercial_facts_promised_dispatch"
  | "orders_admin_promised"
  | "orders_estimated_despatch"
  | "orders_system_estimated"
  | "orders_requested_dispatch"
  | "none";

export type OrderOwnerSlot = "order_handler" | "client_owner" | "account_manager" | "unassigned";

export type OrderOwnerProvenance = "sales_order_draft" | "companies_account_manager" | "none";

export type OrderSourceChannel = "whatsapp" | "buyer_app" | "admin" | "unknown";

export type OrderSourceProvenance = "orders_wamid" | "orders_status_heuristic" | "none";

export interface OrderPriorityOwnerSlaRawFacts {
  orderId: string;
  orderNumber?: string | null;
  status?: string | null;
  createdAt?: string | null;
  dispatchUrgency?: string | null;
  requestedDispatchDate?: string | null;
  adminPromisedDate?: string | null;
  estimatedDespatchDate?: string | null;
  systemEstimatedDate?: string | null;
  commercialPromisedDispatchDate?: string | null;
  commercialRequestedDispatchDate?: string | null;
  wamid?: string | null;
  draftOrderHandlerId?: string | null;
  draftOrderHandlerName?: string | null;
  draftClientOwnerId?: string | null;
  draftClientOwnerName?: string | null;
  accountManagerId?: string | null;
}

export interface OrderPriorityOwnerSlaFacts {
  orderId: string;
  priority: {
    band: OrderPriorityBand;
    rank: number;
    provenance: OrderPriorityProvenance;
    raw: string | null;
  };
  sla: {
    dueDate: string | null;
    promisedDispatchDate: string | null;
    requestedDispatchDate: string | null;
    provenance: SlaDateProvenance;
    overdue: boolean;
    daysUntilDue: number | null;
  };
  owner: {
    userId: string | null;
    displayName: string | null;
    slot: OrderOwnerSlot;
    provenance: OrderOwnerProvenance;
  };
  source: {
    channel: OrderSourceChannel;
    provenance: OrderSourceProvenance;
    wamid: string | null;
  };
  fetchedAt: string;
}

export interface OrderPoolQueueSortInput {
  orderId: string;
  createdAt: string | null;
  hasComplaint?: boolean;
  facts: OrderPriorityOwnerSlaFacts;
}

export type OrderPriorityOwnerSlaActionCode =
  | "CORE_PREREQUISITE_REASSIGN_ORDER_OWNER_V1"
  | "CORE_PREREQUISITE_OVERRIDE_ORDER_PRIORITY_V1";

export class OrderPriorityOwnerSlaActionBlockedError extends Error {
  readonly code: OrderPriorityOwnerSlaActionCode;

  constructor(code: OrderPriorityOwnerSlaActionCode, message: string) {
    super(message);
    this.name = "OrderPriorityOwnerSlaActionBlockedError";
    this.code = code;
  }
}
