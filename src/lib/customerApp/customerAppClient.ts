import { supabase } from "@/integrations/supabase/client";
import type { Database, Json } from "@/integrations/supabase/database.types";
import { parseGovernedHttpsPaymentLink } from "@/lib/order-authority/governedPaymentLink";
import { classifyIntegrationError } from "@/lib/integration-contracts";

import type { PublishedProductProjectionRow } from "@/lib/published-products/types";

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

/** One authoritative Core quote line bound to the active checkout draft. */
export type BuyerCheckoutQuoteLine = {
  product_id: string;
  quantity: number;
  selling_price: number;
  currency: string;
  uom: string;
  gst_rate: number;
  tax_inclusive: boolean;
  sku: string;
  product_name: string;
  minimum_order_quantity: number | null;
  order_increment: number | null;
  min_carton_qty: number | null;
};

/** GST-inclusive Core quotation returned by `customer_checkout_quote_v1`. */
export type BuyerCheckoutQuote = {
  draft_id: string;
  lines: BuyerCheckoutQuoteLine[];
  sales_order_value: number;
  advance_required: number;
  fingerprint: string;
};

const CHECKOUT_QUOTE_FINGERPRINT_PATTERN = /^[0-9a-f]{32}$/;

function finitePositiveNumber(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) && value > 0 ? value : null;
}

function finiteNonNegativeNumber(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) && value >= 0 ? value : null;
}

function nullableFiniteNumber(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function nonEmptyString(value: unknown): string | null {
  return typeof value === "string" && value.trim().length > 0 ? value.trim() : null;
}

/** Validates the Core md5 fingerprint format required for quoted submit. */
export function isCheckoutQuoteFingerprint(value: string): boolean {
  return CHECKOUT_QUOTE_FINGERPRINT_PATTERN.test(value);
}

function normalizeBuyerCheckoutQuoteLine(value: unknown): BuyerCheckoutQuoteLine | null {
  if (!isRecord(value)) return null;
  const productId = nonEmptyString(value.product_id);
  const quantity = finitePositiveNumber(value.quantity);
  const sellingPrice = finitePositiveNumber(value.selling_price);
  const currency = nonEmptyString(value.currency);
  const uom = nonEmptyString(value.uom);
  const gstRate = finiteNonNegativeNumber(value.gst_rate);
  const sku = nonEmptyString(value.sku);
  const productName = nonEmptyString(value.product_name);
  // The Buyer web payment summary is rendered in rupees. Fail closed rather
  // than misrepresent a foreign-currency commercial quote as an INR amount.
  if (!productId || quantity === null || sellingPrice === null || currency !== "INR" ||
      !uom || gstRate === null || gstRate > 100 || !sku || !productName) {
    return null;
  }
  if (typeof value.tax_inclusive !== "boolean") return null;
  return {
    product_id: productId,
    quantity,
    selling_price: sellingPrice,
    currency,
    uom,
    gst_rate: gstRate,
    tax_inclusive: value.tax_inclusive,
    sku,
    product_name: productName,
    minimum_order_quantity: nullableFiniteNumber(value.minimum_order_quantity),
    order_increment: nullableFiniteNumber(value.order_increment),
    min_carton_qty: nullableFiniteNumber(value.min_carton_qty),
  };
}

/** Normalizes Core's authoritative checkout quote payload without local price maths. */
export function normalizeBuyerCheckoutQuote(value: unknown): BuyerCheckoutQuote | null {
  if (!isRecord(value)) return null;
  const draftId = nonEmptyString(value.draft_id);
  const fingerprint = nonEmptyString(value.fingerprint);
  const salesOrderValue = finitePositiveNumber(value.sales_order_value);
  const advanceRequired = finitePositiveNumber(value.advance_required);
  if (!draftId || !fingerprint || !isCheckoutQuoteFingerprint(fingerprint) ||
      salesOrderValue === null || advanceRequired === null || advanceRequired > salesOrderValue) {
    return null;
  }
  if (!Array.isArray(value.lines) || value.lines.length === 0) return null;
  const lines = value.lines
    .map(normalizeBuyerCheckoutQuoteLine)
    .filter((line): line is BuyerCheckoutQuoteLine => Boolean(line));
  if (lines.length !== value.lines.length) return null;
  const sorted = [...lines].sort((a, b) => a.product_id.localeCompare(b.product_id));
  if (sorted.some((line, index) => index > 0 && line.product_id === sorted[index - 1].product_id)) return null;
  return {
    draft_id: draftId,
    lines: sorted,
    sales_order_value: salesOrderValue,
    advance_required: advanceRequired,
    fingerprint,
  };
}

/** Ensures the quote's draft and line product/qty set still matches the editable cart. */
export function draftCartMatchesCheckoutQuote(draftLines: BuyerDraftLine[], quote: BuyerCheckoutQuote): boolean {
  if (quote.draft_id !== draftLines.find((line) => line.draft_id)?.draft_id) return false;
  const cartLines = draftLines
    .filter((line): line is BuyerDraftLine & { product_id: string; quantity: number } => (
      Boolean(line.product_id) && typeof line.quantity === "number" && line.quantity > 0
    ))
    .map((line) => ({ product_id: line.product_id, quantity: line.quantity }))
    .sort((a, b) => a.product_id.localeCompare(b.product_id));
  if (cartLines.length !== quote.lines.length) return false;
  return cartLines.every((cartLine, index) => (
    cartLine.product_id === quote.lines[index]?.product_id
    && cartLine.quantity === quote.lines[index]?.quantity
  ));
}

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

/**
 * Buyer catalogue product, derived from Core's customer-safe `published_products_v1()` publication projection.
 * Buyers cannot read `public.products` directly (Core limits that table to internal staff), so the catalogue must
 * come from the governed projection; prices come separately from `buyer_product_prices_v1()`.
 */
export type BuyerCatalogueProduct = {
  id: string;
  name: string | null;
  sku: string | null;
  description: string | null;
  image_url: string | null;
  category: string | null;
  sub_category: string | null;
  is_active: boolean;
  visible_in_catalog: boolean;
};

export function toBuyerCatalogueProduct(row: PublishedProductProjectionRow): BuyerCatalogueProduct {
  return {
    id: row.product_id,
    name: row.product_name,
    sku: row.sku,
    description: row.long_description ?? row.short_description,
    image_url: row.hero_image_url,
    category: row.category,
    sub_category: row.subcategory,
    // The projection only returns active, visible, catalogue-ready products.
    is_active: true,
    visible_in_catalog: true,
  };
}

type PublishedProductsRpcClient = {
  rpc: (fn: "published_products_v1") => Promise<{ data: PublishedProductProjectionRow[] | null; error: { message: string } | null }>;
};

async function publishedProducts(): Promise<BuyerCatalogueProduct[]> {
  // Local narrow cast: the generated Database type predates this already-deployed Core RPC.
  const result = await (supabase as unknown as PublishedProductsRpcClient).rpc("published_products_v1");
  if (result.error) {
    classifyCustomerRpcFailure(result.error);
    throw new Error(CUSTOMER_SAFE_REQUEST_ERROR);
  }
  return (result.data ?? []).map(toBuyerCatalogueProduct);
}

export const customerAppClient = {
  company: () => rpc("customer_company_v1"),
  team: () => rpc("customer_team_v1"),
  prices: () => rpc("buyer_product_prices_v1"),
  products: () => publishedProducts(),
  draft: () => rpc("get_customer_order_draft_v1"),
  addLine: (productId: string, quantity: number) => rpc("add_customer_order_draft_line_v1", { p_product_id: productId, p_quantity: quantity }),
  updateLine: (lineId: string, quantity: number) => rpc("update_customer_order_draft_line_v1", { p_line_id: lineId, p_quantity: quantity }),
  removeLine: (lineId: string) => rpc("remove_customer_order_draft_line_v1", { p_line_id: lineId }),
  clearDraft: () => rpc("clear_customer_order_draft_v1"),
  checkoutQuote: async () => {
    const raw = await rpc("customer_checkout_quote_v1");
    const quote = normalizeBuyerCheckoutQuote(raw);
    if (!quote) throw new Error(CUSTOMER_SAFE_REQUEST_ERROR);
    return quote;
  },
  submitQuotedOrder: (idempotencyKey: string, quoteFingerprint: string, requestedDispatchDate?: string) => {
    if (!isCheckoutQuoteFingerprint(quoteFingerprint)) {
      throw new Error(CUSTOMER_SAFE_REQUEST_ERROR);
    }
    return rpc("submit_customer_order_quoted_v1", {
      p_idempotency_key: idempotencyKey,
      p_quote_fingerprint: quoteFingerprint,
      p_requested_dispatch_date: requestedDispatchDate || null,
    });
  },
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
    tradeDeclaration: boolean;
    dataConsent: boolean;
  }) => rpc("submit_b2b_access_request_v2", {
    p_business_name: input.businessName,
    p_contact_name: input.contactName,
    p_contact_email: input.contactEmail,
    p_contact_phone: input.contactPhone,
    p_gst_number: input.gstNumber || null,
    p_registered_address: input.address || null,
    p_preferred_dispatch: input.preferredDispatch || null,
    p_preferred_dispatch_other_name: input.preferredDispatchOtherName || null,
    p_trade_declaration: input.tradeDeclaration,
    p_data_consent: input.dataConsent,
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

/** Each company + active Core draft has an independent durable retry scope. */
function checkoutIdempotencyStorageKey(draftId: string, companyId: string): string {
  if (!draftId?.trim() || !companyId?.trim()) throw new Error(CUSTOMER_SAFE_REQUEST_ERROR);
  return `oasis_buyer_checkout_idempotency:${companyId}:${draftId}`;
}

/**
 * Persist one retry key per company and draft before any financial submission.
 * Never fall back to an ephemeral key when storage fails: a lost response
 * could otherwise create a second order after a refresh or account switch.
 */
export function getCheckoutIdempotencyKey(draftId: string, companyId: string): string {
  const storageKey = checkoutIdempotencyStorageKey(draftId, companyId);
  try {
    const existing = sessionStorage.getItem(storageKey);
    if (existing) return existing;
    const generated = crypto.randomUUID();
    sessionStorage.setItem(storageKey, generated);
    if (sessionStorage.getItem(storageKey) !== generated) throw new Error("Persisted key not readable");
    return generated;
  } catch {
    throw new Error(CUSTOMER_SAFE_REQUEST_ERROR);
  }
}

/** Clear only the acknowledged draft's retry key after Core returns a Sales Order. */
export function clearCheckoutIdempotencyKey(draftId: string, companyId: string): void {
  const storageKey = checkoutIdempotencyStorageKey(draftId, companyId);
  try { sessionStorage.removeItem(storageKey); } catch { /* best-effort cleanup after Core success */ }
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
