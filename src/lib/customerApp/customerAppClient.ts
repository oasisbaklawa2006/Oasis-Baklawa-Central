import { supabase } from "@/integrations/supabase/client";
import type { Database, Json } from "@/integrations/supabase/database.types";
import { parseGovernedHttpsPaymentLink } from "@/lib/order-authority/governedPaymentLink";
import { classifyIntegrationError } from "@/lib/integration-contracts";

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

/** Classifies Buyer RPC failures without exposing raw backend messages to UI. */
export function classifyCustomerRpcFailure(err: unknown) {
  return classifyIntegrationError({
    err,
    source: "customer-app-rpc",
    operation: "write",
  });
}

/**
 * Executes a generated customer RPC and preserves Core as the write authority.
 * The typed name/argument/return contract prevents callers from inventing a
 * second checkout or order-writer path. Raw backend errors stay behind the
 * customer boundary instead of being rendered directly in Buyer UI surfaces.
 */
async function rpc<Name extends RpcName>(fn: Name, args?: PublicFunctions[Name]["Args"]): Promise<PublicFunctions[Name]["Returns"]> {
  const result = await supabase.rpc(fn, args as never);
  if (result.error) {
    classifyCustomerRpcFailure(result.error);
    throw new Error(CUSTOMER_SAFE_REQUEST_ERROR);
  }
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
  commercial_version_id?: string | null;
  commercial_version_number?: number | null;
  commercial_status?: string | null;
  finance_status?: string | null;
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

export type BuyerCommercialFacts = {
  order_id: string;
  order_number: string;
  commercial_version_id: string | null;
  commercial_version_number: number | null;
  frozen_sales_order_value: number | null;
  requested_dispatch_date: string | null;
  promised_dispatch_date: string | null;
  commercial_status: string | null;
  finance_status: string | null;
  created_at: string;
  updated_at: string;
};

export type BuyerFinalPaymentPiFacts = {
  order_id: string;
  available: boolean;
  customer_visible_pi_number: string | null;
  revision_number: number | null;
  effective_status: string | null;
  final_payable_total: number | null;
  balance_due: number | null;
  settled: boolean | null;
  payment_action: string | null;
  payment_link: string | null;
  payment_instructions: string | null;
  document_reference: string | null;
  issued_at: string | null;
  facts_as_of: string | null;
  final_invoice_must_not_request_payment: boolean;
};

export type BuyerFinanceFacts = {
  order_id: string;
  order_number: string;
  commercial_version_id: string | null;
  commercial_version_number: number | null;
  commercial_value: number | null;
  required_advance: number | null;
  pi_id: string | null;
  pi_number: string | null;
  pi_status: string | null;
  verified_payment_amount: number | null;
  wallet_applied_amount: number | null;
  approved_credit_amount: number | null;
  covered_amount: number | null;
  advance_covered: boolean | null;
  finance_status: string | null;
  facts_as_of: string | null;
  customer_safe_projection: boolean;
};

export type BuyerProformaInvoiceFacts = {
  pi_id: string;
  customer_visible_pi_number: string | null;
  order_id: string;
  order_number: string;
  commercial_version_id: string | null;
  commercial_version_number: number | null;
  status: string | null;
  issued_at: string | null;
  frozen_customer_total: number | null;
  created_at: string;
};

export type BuyerDocument = {
  document_type: string;
  document_id: string;
  document_number: string | null;
  order_id: string;
  order_number: string;
  commercial_version_id: string | null;
  status: string | null;
  issued_at: string | null;
  customer_total: number | null;
  availability_state: string | null;
};

export type BuyerStatementEntry = {
  order_id: string | null;
  invoice_date: string | null;
  invoice_number: string | null;
  invoice_gross_total: number | null;
  verified_payment_total: number | null;
  wallet_applied_total: number | null;
  approved_credit_total: number | null;
  credit_note_total: number | null;
  debit_note_total: number | null;
  refund_total: number | null;
  pre_dispatch_net_due: number | null;
  complaint_window_status: string | null;
  complaint_deadline: string | null;
  commercially_closed: boolean | null;
};

export type BuyerStatement = {
  company_id: string;
  wallet_balance: number | null;
  entries: BuyerStatementEntry[];
  facts_as_of: string | null;
  statement_facts_only: boolean;
};

export const GENERAL_QUERY_CATEGORIES = ["GENERAL", "CATALOGUE", "ACCOUNT", "DELIVERY", "OTHER"] as const;
export type BuyerGeneralQueryCategory = (typeof GENERAL_QUERY_CATEGORIES)[number];

export type BuyerGeneralQuery = {
  query_id: string;
  category: string;
  subject: string;
  message: string;
  status: string;
  created_at: string;
  updated_at: string;
};

const GENERAL_QUERY_STATUSES = ["SUBMITTED", "ACKNOWLEDGED", "RESOLVED", "CLOSED"] as const;

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function nullableString(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value : null;
}

function nullableNumber(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function nullableBoolean(value: unknown): boolean | null {
  return typeof value === "boolean" ? value : null;
}

/** Normalizes Core #178 customer-safe final-payment PI facts without inventing local PI truth. */
export function normalizeBuyerFinalPaymentPiFacts(value: unknown): BuyerFinalPaymentPiFacts | null {
  if (!isRecord(value)) return null;
  const orderId = nullableString(value.order_id);
  if (!orderId || value.final_invoice_must_not_request_payment !== true) return null;
  return {
    order_id: orderId,
    available: value.available === true,
    customer_visible_pi_number: nullableString(value.customer_visible_pi_number),
    revision_number: nullableNumber(value.revision_number),
    effective_status: nullableString(value.effective_status),
    final_payable_total: nullableNumber(value.final_payable_total),
    balance_due: nullableNumber(value.balance_due),
    settled: nullableBoolean(value.settled),
    payment_action: nullableString(value.payment_action),
    payment_link: parseGovernedHttpsPaymentLink(nullableString(value.payment_link)),
    payment_instructions: nullableString(value.payment_instructions),
    document_reference: nullableString(value.document_reference),
    issued_at: nullableString(value.issued_at),
    facts_as_of: nullableString(value.facts_as_of),
    final_invoice_must_not_request_payment: true,
  };
}

/** Normalizes Core's customer-safe Finance JSON without exposing arbitrary backend keys. */
export function normalizeBuyerFinanceFacts(value: unknown): BuyerFinanceFacts | null {
  if (!isRecord(value)) return null;
  const orderId = nullableString(value.order_id);
  const orderNumber = nullableString(value.order_number);
  if (!orderId || !orderNumber) return null;
  return {
    order_id: orderId,
    order_number: orderNumber,
    commercial_version_id: nullableString(value.commercial_version_id),
    commercial_version_number: nullableNumber(value.commercial_version_number),
    commercial_value: nullableNumber(value.commercial_value),
    required_advance: nullableNumber(value.required_advance),
    pi_id: nullableString(value.pi_id),
    pi_number: nullableString(value.pi_number),
    pi_status: nullableString(value.pi_status),
    verified_payment_amount: nullableNumber(value.verified_payment_amount),
    wallet_applied_amount: nullableNumber(value.wallet_applied_amount),
    approved_credit_amount: nullableNumber(value.approved_credit_amount),
    covered_amount: nullableNumber(value.covered_amount),
    advance_covered: nullableBoolean(value.advance_covered),
    finance_status: nullableString(value.finance_status),
    facts_as_of: nullableString(value.facts_as_of),
    customer_safe_projection: value.customer_safe_projection === true,
  };
}

function normalizeBuyerStatementEntry(value: unknown): BuyerStatementEntry | null {
  if (!isRecord(value)) return null;
  return {
    order_id: nullableString(value.order_id),
    invoice_date: nullableString(value.invoice_date),
    invoice_number: nullableString(value.invoice_number),
    invoice_gross_total: nullableNumber(value.invoice_gross_total),
    verified_payment_total: nullableNumber(value.verified_payment_total),
    wallet_applied_total: nullableNumber(value.wallet_applied_total),
    approved_credit_total: nullableNumber(value.approved_credit_total),
    credit_note_total: nullableNumber(value.credit_note_total),
    debit_note_total: nullableNumber(value.debit_note_total),
    refund_total: nullableNumber(value.refund_total),
    pre_dispatch_net_due: nullableNumber(value.pre_dispatch_net_due),
    complaint_window_status: nullableString(value.complaint_window_status),
    complaint_deadline: nullableString(value.complaint_deadline),
    commercially_closed: nullableBoolean(value.commercially_closed),
  };
}

/** Keeps only the documented customer statement facts and drops internal closure metadata. */
export function normalizeBuyerStatement(value: unknown): BuyerStatement | null {
  if (!isRecord(value)) return null;
  const companyId = nullableString(value.company_id);
  if (!companyId) return null;
  const entries = Array.isArray(value.entries)
    ? value.entries.map(normalizeBuyerStatementEntry).filter((entry): entry is BuyerStatementEntry => Boolean(entry))
    : [];
  return {
    company_id: companyId,
    wallet_balance: nullableNumber(value.wallet_balance),
    entries,
    facts_as_of: nullableString(value.facts_as_of),
    statement_facts_only: value.statement_facts_only === true,
  };
}

function normalizeGeneralQueryCategory(value: string): BuyerGeneralQueryCategory {
  const category = value.trim().toUpperCase() as BuyerGeneralQueryCategory;
  return GENERAL_QUERY_CATEGORIES.includes(category) ? category : "GENERAL";
}

function normalizeGeneralQueryStatus(value: unknown): string {
  const status = typeof value === "string" ? value.trim().toUpperCase() : "";
  return GENERAL_QUERY_STATUSES.includes(status as (typeof GENERAL_QUERY_STATUSES)[number]) ? status : "SUBMITTED";
}

export function normalizeBuyerGeneralQuery(value: unknown): BuyerGeneralQuery | null {
  if (!isRecord(value)) return null;
  const queryId = nullableString(value.query_id);
  const subject = nullableString(value.subject);
  const message = nullableString(value.message);
  if (!queryId || !subject || !message) return null;
  return {
    query_id: queryId,
    category: normalizeGeneralQueryCategory(typeof value.category === "string" ? value.category : "GENERAL"),
    subject,
    message,
    status: normalizeGeneralQueryStatus(value.status),
    created_at: nullableString(value.created_at) || "",
    updated_at: nullableString(value.updated_at) || "",
  };
}

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
  commercialFacts: () => rpc("customer_sales_order_commercial_facts_v1"),
  financeFacts: async (orderId: string) => normalizeBuyerFinanceFacts(await rpc("customer_order_finance_facts_v1", { p_order_id: orderId })),
  finalPaymentPiFacts: async (orderId: string) => normalizeBuyerFinalPaymentPiFacts(
    await rpc("get_sales_order_pi_final_payment_request_v1", { p_order_id: orderId }),
  ),
  proformaInvoices: () => rpc("customer_proforma_invoice_facts_v1"),
  documents: () => rpc("customer_documents_v1"),
  statement: async () => normalizeBuyerStatement(await rpc("customer_statement_v1")),
  favourites: () => rpc("customer_product_favourites_v1"),
  setFavourite: (productId: string, isFavourite: boolean) => rpc("set_customer_product_favourite_v1", { p_product_id: productId, p_is_favourite: isFavourite }),
  tickets: () => rpc("customer_support_tickets_v1"),
  submitApplication: (input: {
    businessName: string;
    contactName: string;
    contactEmail: string;
    contactPhone: string;
    gstNumber?: string;
    address?: string;
    preferredDispatch?: string | null;
    preferredDispatchOtherName?: string | null;
  }) => rpc("submit_b2b_trade_application_v1", {
    p_business_name: input.businessName,
    p_contact_name: input.contactName,
    p_contact_email: input.contactEmail,
    p_contact_phone: input.contactPhone,
    p_mobile_number: input.contactPhone,
    p_gst_number: input.gstNumber || null,
    p_registered_address: input.address || null,
    p_preferred_dispatch: input.preferredDispatch || null,
    p_preferred_dispatch_other_name: input.preferredDispatchOtherName || null,
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
  generalQueries: async () => (await rpc("customer_general_queries_v1"))
    .map(normalizeBuyerGeneralQuery)
    .filter((query): query is BuyerGeneralQuery => Boolean(query)),
  submitGeneralQuery: (input: { idempotencyKey: string; subject: string; message: string; category: BuyerGeneralQueryCategory }) => rpc("submit_customer_general_query_v1", {
    p_idempotency_key: input.idempotencyKey,
    p_subject: input.subject,
    p_message: input.message,
    p_category: normalizeGeneralQueryCategory(input.category),
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

let fallbackGeneralQueryKey: string | null = null;

/** Returns a stable session key so a lost general-query response can be retried safely. */
export function getGeneralQueryIdempotencyKey(): string {
  const key = "oasis_buyer_general_query_idempotency";
  try {
    const existing = sessionStorage.getItem(key);
    if (existing) return existing;
    const generated = crypto.randomUUID();
    sessionStorage.setItem(key, generated);
    return generated;
  } catch {
    fallbackGeneralQueryKey ??= crypto.randomUUID();
    return fallbackGeneralQueryKey;
  }
}

/** Clears the general-query retry key once Core acknowledges the submission. */
export function clearGeneralQueryIdempotencyKey() {
  fallbackGeneralQueryKey = null;
  try { sessionStorage.removeItem("oasis_buyer_general_query_idempotency"); } catch { /* storage disabled */ }
}
