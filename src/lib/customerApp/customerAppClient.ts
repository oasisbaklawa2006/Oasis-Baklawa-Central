import { supabase } from "@/integrations/supabase/client";

type RpcError = { message: string; code?: string } | null;

async function rpc<T>(fn: string, args?: Record<string, unknown>): Promise<T> {
  const result = await (supabase as unknown as { rpc: (name: string, params?: Record<string, unknown>) => Promise<{ data: T; error: RpcError }> }).rpc(fn, args);
  if (result.error) throw new Error(result.error.message);
  return result.data;
}

export type BuyerCompany = {
  company_id: string;
  business_name: string | null;
  gst_number: string | null;
  status: string | null;
  price_tier: string | null;
  payment_terms: string | null;
  registered_address: string | null;
  phone: string | null;
  is_frozen: boolean;
};

export type BuyerTeamMember = {
  profile_id: string;
  full_name: string | null;
  email: string | null;
  mobile_number: string | null;
  role: string | null;
  status: string | null;
};

export type BuyerPrice = {
  product_id: string;
  selling_price: number;
  currency: string;
  uom: string | null;
  gst_rate: number | null;
  tax_inclusive: boolean;
  applied_discount_percent: number | null;
  minimum_order_quantity: number | null;
  minimum_order_uom: string | null;
  order_increment: number | null;
  order_increment_uom: string | null;
  valid_from: string | null;
  valid_until: string | null;
};

export type BuyerDraftLine = {
  draft_id: string;
  company_id: string;
  status: string;
  readiness_status: "ready" | "not_ready";
  readiness_issues: unknown[];
  line_id: string | null;
  product_id: string | null;
  quantity: number | null;
  unit_price_snapshot: number | null;
  currency_snapshot: string | null;
  uom_snapshot: string | null;
  sku_snapshot: string | null;
  product_name_snapshot: string | null;
};

export type BuyerOrder = {
  order_id: string;
  order_number: string;
  customer_stage: string;
  payment_stage: string;
  order_value: number | null;
  total_weight_kg: number | null;
  requested_dispatch_date: string | null;
  promised_dispatch_date: string | null;
  tracking_number: string | null;
  courier_name: string | null;
  created_at: string;
  updated_at: string;
};

export type BuyerOrderItem = {
  order_id: string;
  item_id: string;
  product_id: string;
  sku: string | null;
  product_name: string | null;
  quantity: number;
  pack_size: string | null;
  weight_kg: number | null;
  packed_quantity: number | null;
};

export type BuyerTicket = {
  ticket_id: string;
  order_id: string;
  order_number: string;
  issue_type: string;
  description: string;
  customer_status: string;
  product_sku: string | null;
  quantity_affected: number | null;
  created_at: string;
  updated_at: string;
  first_response_due: string | null;
  resolution_due: string | null;
  resolved_at: string | null;
  customer_rating: number | null;
};

export const customerAppClient = {
  company: () => rpc<BuyerCompany[]>("customer_company_v1"),
  team: () => rpc<BuyerTeamMember[]>("customer_team_v1"),
  prices: () => rpc<BuyerPrice[]>("buyer_product_prices_v1"),
  draft: () => rpc<BuyerDraftLine[]>("get_customer_order_draft_v1"),
  addLine: (productId: string, quantity: number) => rpc("add_customer_order_draft_line_v1", { p_product_id: productId, p_quantity: quantity }),
  updateLine: (lineId: string, quantity: number) => rpc("update_customer_order_draft_line_v1", { p_line_id: lineId, p_quantity: quantity }),
  removeLine: (lineId: string) => rpc("remove_customer_order_draft_line_v1", { p_line_id: lineId }),
  clearDraft: () => rpc("clear_customer_order_draft_v1"),
  submit: (idempotencyKey: string, requestedDispatchDate?: string) => rpc<Array<{ order_id: string; order_number: string; sales_order_value: number; advance_required: number; draft_id: string; is_duplicate_submission: boolean }>>("submit_customer_order_v1", {
    p_idempotency_key: idempotencyKey,
    p_requested_dispatch_date: requestedDispatchDate || null,
  }),
  orders: () => rpc<BuyerOrder[]>("customer_order_status_v1"),
  items: () => rpc<BuyerOrderItem[]>("customer_order_items_v1"),
  tickets: () => rpc<BuyerTicket[]>("customer_support_tickets_v1"),
  submitTicket: (orderId: string, issueType: string, description: string, sku?: string, quantity?: number) => rpc<string>("submit_customer_support_ticket_v1", {
    p_order_id: orderId,
    p_issue_type: issueType,
    p_description: description,
    p_product_sku: sku || null,
    p_quantity_affected: quantity ?? null,
  }),
};

let fallbackCheckoutKey: string | null = null;

export function getCheckoutIdempotencyKey(): string {
  const key = "oasis_buyer_checkout_idempotency";
  try {
    const existing = sessionStorage.getItem(key);
    if (existing) return existing;
    const generated = crypto.randomUUID();
    sessionStorage.setItem(key, generated);
    return generated;
  } catch {
    // Private browsing/storage-disabled clients still retain one in-memory key
    // for lost-response retries during this page lifetime.
    fallbackCheckoutKey ??= crypto.randomUUID();
    return fallbackCheckoutKey;
  }
}

export function clearCheckoutIdempotencyKey() {
  fallbackCheckoutKey = null;
  try { sessionStorage.removeItem("oasis_buyer_checkout_idempotency"); } catch { /* storage disabled */ }
}
