import { supabase } from "@/integrations/supabase/client";
import type { Database, Json } from "@/integrations/supabase/database.types";

type PublicFunctions = Database["public"]["Functions"];
type RpcName = keyof PublicFunctions;

const CUSTOMER_SAFE_REQUEST_ERROR = "We couldn't complete that request. Please try again.";

const CANONICAL_SUPPORT_ISSUE_TYPES: Record<string, string> = {
  "damaged goods": "Damaged Goods",
  "missing items": "Missing Items",
  "wrong shipment": "Wrong Shipment",
  "delivery question": "Other",
  "other order question": "Other",
  other: "Other",
};

/** Normalizes Buyer-facing labels to the established support-ticket payload vocabulary. */
export function canonicalSupportIssueType(issueType: string): string {
  return CANONICAL_SUPPORT_ISSUE_TYPES[issueType.trim().toLowerCase()] || "Other";
}

/**
 * Executes a generated customer RPC and preserves Core as the write authority.
 * The typed name/argument/return contract prevents callers from inventing a
 * second checkout or order-writer path. Raw backend errors stay behind the
 * customer boundary instead of being rendered directly in Buyer UI surfaces.
 */
async function rpc<Name extends RpcName>(fn: Name, args?: PublicFunctions[Name]["Args"]): Promise<PublicFunctions[Name]["Returns"]> {
  const result = await supabase.rpc(fn, args as never);
  if (result.error) throw new Error(CUSTOMER_SAFE_REQUEST_ERROR);
  return result.data as PublicFunctions[Name]["Returns"];
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
  readiness_status: string;
  readiness_issues: Json;
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
  company: () => rpc("customer_company_v1"),
  team: () => rpc("customer_team_v1"),
  prices: () => rpc("buyer_product_prices_v1"),
  draft: () => rpc("get_customer_order_draft_v1"),
  addLine: (productId: string, quantity: number) => rpc("add_customer_order_draft_line_v1", { p_product_id: productId, p_quantity: quantity }),
  updateLine: (lineId: string, quantity: number) => rpc("update_customer_order_draft_line_v1", { p_line_id: lineId, p_quantity: quantity }),
  removeLine: (lineId: string) => rpc("remove_customer_order_draft_line_v1", { p_line_id: lineId }),
  clearDraft: () => rpc("clear_customer_order_draft_v1"),
  submit: (idempotencyKey: string, requestedDispatchDate?: string) => rpc("submit_customer_order_v1", {
    p_idempotency_key: idempotencyKey,
    p_requested_dispatch_date: requestedDispatchDate || null,
  }),
  orders: () => rpc("customer_order_status_v1"),
  items: () => rpc("customer_order_items_v1"),
  tickets: () => rpc("customer_support_tickets_v1"),
  submitApplication: (input: { businessName: string; contactName: string; contactEmail: string; contactPhone: string; gstNumber?: string; address?: string }) => rpc("submit_b2b_trade_application_v1", {
    p_business_name: input.businessName,
    p_contact_name: input.contactName,
    p_contact_email: input.contactEmail,
    p_contact_phone: input.contactPhone,
    p_mobile_number: input.contactPhone,
    p_gst_number: input.gstNumber || null,
    p_registered_address: input.address || null,
    p_trade_declaration: true,
    p_data_consent: true,
  }),
  submitTicket: (orderId: string, issueType: string, description: string, sku?: string, quantity?: number) => rpc("submit_customer_support_ticket_v1", {
    p_order_id: orderId,
    p_issue_type: canonicalSupportIssueType(issueType),
    p_description: description,
    p_product_sku: sku || null,
    p_quantity_affected: quantity ?? null,
  }),
};

let fallbackCheckoutKey: string | null = null;

/**
 * Returns the stable browser-session key used to make checkout retries
 * idempotent when the first response is lost or a buyer double-clicks.
 */
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

/** Clears the checkout retry key after Core has acknowledged the submission. */
export function clearCheckoutIdempotencyKey() {
  fallbackCheckoutKey = null;
  try { sessionStorage.removeItem("oasis_buyer_checkout_idempotency"); } catch { /* storage disabled */ }
}

/** Formats a Date for an HTML date input using the browser's local calendar. */
export function getLocalDateInputValue(value: Date = new Date()): string {
  return `${value.getFullYear()}-${String(value.getMonth() + 1).padStart(2, "0")}-${String(value.getDate()).padStart(2, "0")}`;
}
