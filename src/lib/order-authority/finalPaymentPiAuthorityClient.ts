import { supabase } from "@/integrations/supabase/client";

type RpcError = { message: string; code?: string; details?: string; hint?: string };
type RpcClient = {
  rpc<T = unknown>(fn: string, args: Record<string, unknown>): Promise<{ data: T | null; error: RpcError | null }>;
};

const db = supabase as unknown as RpcClient;

export class FinalPaymentPiAuthorityError extends Error {
  readonly code?: string;
  constructor(error: RpcError | string) {
    super(typeof error === "string" ? error : error.message);
    this.name = "FinalPaymentPiAuthorityError";
    if (typeof error !== "string") this.code = error.code;
  }
}

export type FinalPaymentPiDeliveryChannel = "WHATSAPP" | "IN_APP" | "EMAIL" | "SMS" | "OTHER";
export type FinalPaymentPiDeliveryStatus = "QUEUED" | "SENT" | "DELIVERED" | "FAILED";
export type FinalPaymentPiPaymentAction = "PAY_NOW" | "BANK_TRANSFER" | "CONTACT_FINANCE";

export type FinalPaymentPiDeliveryFacts = {
  deliveryId: string | null;
  channel: FinalPaymentPiDeliveryChannel | null;
  destinationReference: string | null;
  providerMessageId: string | null;
  deliveryStatus: FinalPaymentPiDeliveryStatus | null;
  evidenceReference: string | null;
  deliveredAt: string | null;
  createdAt: string | null;
};

export type FinalPaymentPiFacts = {
  orderId: string;
  available: boolean;
  finalPaymentRequestId: string | null;
  piId: string | null;
  customerVisiblePiNumber: string | null;
  revisionNumber: number | null;
  effectiveStatus: string | null;
  financeDplReceiptId: string | null;
  commercialVersionId: string | null;
  dplFingerprint: string | null;
  currency: string | null;
  taxableTotal: number | null;
  taxTotal: number | null;
  finalPayableTotal: number | null;
  verifiedPaymentTotal: number | null;
  walletAppliedTotal: number | null;
  approvedCreditTotal: number | null;
  creditedOrPaidTotal: number | null;
  balanceDue: number | null;
  settled: boolean | null;
  paymentAction: FinalPaymentPiPaymentAction | null;
  paymentLink: string | null;
  paymentInstructions: string | null;
  documentReference: string | null;
  reason: string | null;
  sourceChannel: string | null;
  sourceReference: string | null;
  issuedAt: string | null;
  latestDelivery: FinalPaymentPiDeliveryFacts | null;
  factsAsOf: string | null;
  finalInvoiceMustNotRequestPayment: boolean;
};

export type IssueFinalPaymentPiInput = {
  orderId: string;
  piId: string;
  commercialVersionId: string;
  financeDplReceiptId: string;
  documentReference: string;
  paymentAction: FinalPaymentPiPaymentAction;
  paymentLink?: string | null;
  paymentInstructions: string;
  reason: string;
  sourceChannel: string;
  sourceReference?: string | null;
  correlationId: string;
  idempotencyKey: string;
  actorId: string;
};

export type IssueFinalPaymentPiResult = {
  finalPaymentRequestId: string;
  revisionNumber: number;
  customerVisiblePiNumber: string;
  finalPayableTotal: number;
  balanceDue: number;
  alreadyIssued: boolean;
};

export type RecordFinalPaymentPiDeliveryInput = {
  finalPaymentRequestId: string;
  channel: FinalPaymentPiDeliveryChannel;
  destinationReference: string;
  providerMessageId?: string | null;
  deliveryStatus: FinalPaymentPiDeliveryStatus;
  evidenceReference: string;
  deliveredAt?: string | null;
  correlationId: string;
  idempotencyKey: string;
  actorId: string;
};

export type RecordFinalPaymentPiDeliveryResult = {
  deliveryId: string;
  alreadyRecorded: boolean;
};

function required(value: string, field: string): string {
  const normalized = value.trim();
  if (!normalized) throw new FinalPaymentPiAuthorityError(`${field} is required`);
  return normalized;
}

function numberOrNull(value: unknown): number | null {
  const number = typeof value === "number" ? value : typeof value === "string" ? Number(value) : NaN;
  return Number.isFinite(number) ? number : null;
}

function optionalString(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function row(data: unknown, operation: string): Record<string, unknown> {
  const value = Array.isArray(data) ? data[0] : data;
  if (!value || typeof value !== "object") throw new FinalPaymentPiAuthorityError(`${operation} returned no governed result`);
  return value as Record<string, unknown>;
}

async function call<T>(fn: string, args: Record<string, unknown>): Promise<T> {
  const { data, error } = await db.rpc<T>(fn, args);
  if (error) throw new FinalPaymentPiAuthorityError(error);
  if (data === null || data === undefined) throw new FinalPaymentPiAuthorityError(`${fn} returned no governed result`);
  return data;
}

async function sha256(value: string): Promise<string> {
  if (!globalThis.crypto?.subtle) throw new FinalPaymentPiAuthorityError("Web Crypto SHA-256 is unavailable");
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value));
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, "0")).join("");
}

function normalizeIdentity(identity: string, purpose: string): string {
  const normalized = identity.trim();
  if (!normalized) throw new FinalPaymentPiAuthorityError(`A stable final-payment PI identity is required for ${purpose}`);
  return normalized;
}

export async function buildFinalPaymentPiIdempotencyKey(
  operation: "issue" | "deliver",
  identity: string,
): Promise<string> {
  const normalized = normalizeIdentity(identity, "idempotency");
  const digest = await sha256(`fin-pay-pi:${operation}:${normalized}`);
  return `central:fin-pay-pi:${operation}:${digest}`;
}

export async function buildFinalPaymentPiCorrelationId(
  operation: "issue" | "deliver",
  identity: string,
): Promise<string> {
  const normalized = normalizeIdentity(identity, "correlation");
  const digest = await sha256(`fin-pay-pi:${operation}:${normalized}`);
  return `central:fin-pay-pi:${operation}:${digest}`;
}

function parseDeliveryFacts(value: unknown): FinalPaymentPiDeliveryFacts | null {
  if (!value || typeof value !== "object") return null;
  const delivery = value as Record<string, unknown>;
  return {
    deliveryId: optionalString(delivery.delivery_id),
    channel: optionalString(delivery.channel) as FinalPaymentPiDeliveryChannel | null,
    destinationReference: optionalString(delivery.destination_reference),
    providerMessageId: optionalString(delivery.provider_message_id),
    deliveryStatus: optionalString(delivery.delivery_status) as FinalPaymentPiDeliveryStatus | null,
    evidenceReference: optionalString(delivery.evidence_reference),
    deliveredAt: optionalString(delivery.delivered_at),
    createdAt: optionalString(delivery.created_at),
  };
}

export function parseFinalPaymentPiFacts(value: unknown): FinalPaymentPiFacts {
  if (!value || typeof value !== "object") throw new FinalPaymentPiAuthorityError("Invalid final-payment PI facts from Core");
  const facts = value as Record<string, unknown>;
  if (facts.final_invoice_must_not_request_payment !== true) {
    throw new FinalPaymentPiAuthorityError("Core final-payment PI facts did not preserve invoice/payment separation");
  }
  return {
    orderId: required(String(facts.order_id ?? ""), "order id"),
    available: facts.available === true,
    finalPaymentRequestId: optionalString(facts.final_payment_request_id),
    piId: optionalString(facts.pi_id),
    customerVisiblePiNumber: optionalString(facts.customer_visible_pi_number),
    revisionNumber: numberOrNull(facts.revision_number),
    effectiveStatus: optionalString(facts.effective_status),
    financeDplReceiptId: optionalString(facts.finance_dpl_receipt_id),
    commercialVersionId: optionalString(facts.commercial_version_id),
    dplFingerprint: optionalString(facts.dpl_fingerprint),
    currency: optionalString(facts.currency),
    taxableTotal: numberOrNull(facts.taxable_total),
    taxTotal: numberOrNull(facts.tax_total),
    finalPayableTotal: numberOrNull(facts.final_payable_total),
    verifiedPaymentTotal: numberOrNull(facts.verified_payment_total),
    walletAppliedTotal: numberOrNull(facts.wallet_applied_total),
    approvedCreditTotal: numberOrNull(facts.approved_credit_total),
    creditedOrPaidTotal: numberOrNull(facts.credited_or_paid_total),
    balanceDue: numberOrNull(facts.balance_due),
    settled: typeof facts.settled === "boolean" ? facts.settled : null,
    paymentAction: optionalString(facts.payment_action) as FinalPaymentPiPaymentAction | null,
    paymentLink: optionalString(facts.payment_link),
    paymentInstructions: optionalString(facts.payment_instructions),
    documentReference: optionalString(facts.document_reference),
    reason: optionalString(facts.reason),
    sourceChannel: optionalString(facts.source_channel),
    sourceReference: optionalString(facts.source_reference),
    issuedAt: optionalString(facts.issued_at),
    latestDelivery: parseDeliveryFacts(facts.latest_delivery),
    factsAsOf: optionalString(facts.facts_as_of),
    finalInvoiceMustNotRequestPayment: true,
  };
}

export async function getFinalPaymentPiFacts(orderId: string): Promise<FinalPaymentPiFacts> {
  return parseFinalPaymentPiFacts(await call("get_sales_order_pi_final_payment_request_v1", {
    p_order_id: required(orderId, "order id"),
  }));
}

export async function issueFinalPaymentPiRevision(input: IssueFinalPaymentPiInput): Promise<IssueFinalPaymentPiResult> {
  const actorId = required(input.actorId, "actor id");
  const mapped = row(await call("issue_sales_order_pi_final_payment_request_v1", {
    p_order_id: required(input.orderId, "order id"),
    p_pi_id: required(input.piId, "PI id"),
    p_commercial_version_id: required(input.commercialVersionId, "commercial version id"),
    p_finance_dpl_receipt_id: required(input.financeDplReceiptId, "Finance DPL receipt id"),
    p_document_reference: required(input.documentReference, "document reference"),
    p_payment_action: input.paymentAction,
    p_payment_link: input.paymentLink ?? null,
    p_payment_instructions: required(input.paymentInstructions, "payment instructions"),
    p_reason: required(input.reason, "reason"),
    p_source_channel: required(input.sourceChannel, "source channel"),
    p_source_reference: input.sourceReference ?? null,
    p_correlation_id: required(input.correlationId, "correlation id"),
    p_idempotency_key: required(input.idempotencyKey, "idempotency key"),
    p_actor_id: actorId,
  }), "issueFinalPaymentPiRevision");
  return {
    finalPaymentRequestId: required(String(mapped.final_payment_request_id ?? ""), "final payment request id"),
    revisionNumber: numberOrNull(mapped.revision_number) ?? 0,
    customerVisiblePiNumber: required(String(mapped.customer_visible_pi_number ?? ""), "customer-visible PI number"),
    finalPayableTotal: numberOrNull(mapped.final_payable_total) ?? 0,
    balanceDue: numberOrNull(mapped.balance_due) ?? 0,
    alreadyIssued: mapped.already_issued === true,
  };
}

export async function recordFinalPaymentPiDelivery(
  input: RecordFinalPaymentPiDeliveryInput,
): Promise<RecordFinalPaymentPiDeliveryResult> {
  const actorId = required(input.actorId, "actor id");
  const mapped = row(await call("record_sales_order_pi_final_payment_delivery_v1", {
    p_final_payment_request_id: required(input.finalPaymentRequestId, "final payment request id"),
    p_channel: input.channel,
    p_destination_reference: required(input.destinationReference, "destination reference"),
    p_provider_message_id: input.providerMessageId ?? null,
    p_delivery_status: input.deliveryStatus,
    p_evidence_reference: required(input.evidenceReference, "evidence reference"),
    p_delivered_at: input.deliveredAt ?? null,
    p_correlation_id: required(input.correlationId, "correlation id"),
    p_idempotency_key: required(input.idempotencyKey, "idempotency key"),
    p_actor_id: actorId,
  }), "recordFinalPaymentPiDelivery");
  return {
    deliveryId: required(String(mapped.delivery_id ?? ""), "delivery id"),
    alreadyRecorded: mapped.already_recorded === true,
  };
}
