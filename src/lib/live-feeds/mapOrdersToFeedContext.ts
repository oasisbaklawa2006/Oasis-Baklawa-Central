import type { OperationalFeedContext, OperationalOrderFeedRow } from "./feedTypes";

export interface WarRoomOrderLike {
  id: string;
  status: string;
  payment_status?: string | null;
  advance_paid?: number | null;
  advance_required?: number | null;
  created_at: string | null;
  sales_order_value?: number | null;
  dispatch_urgency?: string | null;
  company_id?: string | null;
  company_name?: string;
  company_status?: string | null;
  needs_clarification?: boolean | null;
  is_duplicate?: boolean | null;
  has_complaint?: boolean;
  min_confidence?: number | null;
}

export function mapOrdersToFeedContext(
  orders: WarRoomOrderLike[],
  opts?: {
    factoryInventoryCount?: number | null;
    factoryInventoryError?: string | null;
    scanAnomalyCount?: number | null;
    reservationRiskCount?: number | null;
    orderQueryError?: string | null;
  },
): OperationalFeedContext {
  const rows: OperationalOrderFeedRow[] = orders.map((o) => ({
    id: o.id,
    status: o.status,
    payment_status: o.payment_status,
    advance_paid: o.advance_paid,
    advance_required: o.advance_required,
    created_at: o.created_at,
    sales_order_value: o.sales_order_value,
    dispatch_urgency: o.dispatch_urgency,
    company_id: o.company_id,
    company_name: o.company_name,
    company_status: o.company_status,
    needs_clarification: o.needs_clarification,
    is_duplicate: o.is_duplicate,
    has_complaint: o.has_complaint,
    min_confidence: o.min_confidence,
  }));

  return {
    orders: rows,
    loadedAt: new Date().toISOString(),
    orderQueryError: opts?.orderQueryError ?? null,
    factoryInventoryCount: opts?.factoryInventoryCount ?? null,
    factoryInventoryError: opts?.factoryInventoryError ?? null,
    scanAnomalyCount: opts?.scanAnomalyCount ?? null,
    reservationRiskCount: opts?.reservationRiskCount ?? null,
  };
}
