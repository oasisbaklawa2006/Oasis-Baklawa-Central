import { supabase } from "@/integrations/supabase/client";

type RpcError = { message: string; code?: string; details?: string; hint?: string };
type RpcClient = {
  rpc<T = unknown>(fn: string, args: Record<string, unknown>): Promise<{ data: T | null; error: RpcError | null }>;
  from(table: string): QueryBuilder;
};
type QueryResult = { data: unknown; error: RpcError | null };
type QueryBuilder = PromiseLike<QueryResult> & {
  select(columns: string): QueryBuilder;
  eq(column: string, value: unknown): QueryBuilder;
  in(column: string, values: readonly unknown[]): QueryBuilder;
  order(column: string, options: { ascending: boolean }): QueryBuilder;
  limit(count: number): QueryBuilder;
};

const db = supabase as unknown as RpcClient;

export class PaymentAuthorityError extends Error {
  readonly code?: string;
  readonly details?: string;

  constructor(error: RpcError | string) {
    const message = typeof error === "string" ? error : error.message;
    super(message);
    this.name = "PaymentAuthorityError";
    if (typeof error !== "string") {
      this.code = error.code;
      this.details = error.details;
    }
  }
}

export type PaymentProofInput = {
  orderId: string;
  piId: string;
  commercialVersionId: string;
  paymentType: "advance" | "balance" | "adjustment";
  submittedAmount: number;
  currency: string;
  paymentMode?: string | null;
  externalReference?: string | null;
  payerReference?: string | null;
  proofEvidenceReference: string;
  sourceChannel: string;
  sourceReference: string;
  correlationId: string;
  idempotencyKey: string;
  actorId: string;
};

export type PaymentProofResult = { paymentId: string; status: string; alreadyRecorded: boolean };

export type PaymentVerificationInput = {
  paymentId: string;
  verifiedAmount: number;
  verifiedReference?: string | null;
  verificationEvidenceReference: string;
  reason?: string | null;
  correlationId: string;
  idempotencyKey: string;
  actorId: string;
};

export type PaymentVerificationResult = { paymentId: string; status: string; alreadyVerified: boolean };

export type PaymentRejectionInput = {
  paymentId: string;
  reason: string;
  correlationId: string;
  idempotencyKey: string;
  actorId: string;
};

export type PaymentRejectionResult = { paymentId: string; status: string; alreadyRejected: boolean };

export type PaymentFact = {
  paymentId: string;
  status: string;
  paymentType: string;
  submittedAmount: number;
  verifiedAmount: number | null;
  currency: string | null;
  paymentMode: string | null;
  externalReference: string | null;
  sourceChannel: string | null;
  sourceReference: string | null;
  proofReceivedAt: string | null;
  verifiedAt: string | null;
  rejectedAt: string | null;
};

export type PaymentFacts = {
  piId: string;
  orderId: string;
  commercialVersionId: string;
  commercialVersionNumber: number;
  commercialValue: number;
  verifiedTotal: number;
  remainingCommercialAmount: number;
  payments: PaymentFact[];
};

export type PaymentBinding = { piId: string; orderId: string; commercialVersionId: string; status: string };

function row<T>(data: unknown, operation: string): T {
  const value = Array.isArray(data) ? data[0] : data;
  if (!value || typeof value !== "object") throw new PaymentAuthorityError(`${operation} returned no governed result`);
  return value as T;
}

function requiredString(value: unknown, field: string): string {
  if (typeof value !== "string" || value.trim() === "") throw new PaymentAuthorityError(`Invalid ${field} from Core payment authority`);
  return value;
}

function assertActorId(actorId: string): void {
  requiredString(actorId, "authenticated actor");
}

function requiredNumber(value: unknown, field: string): number {
  const number = typeof value === "number" ? value : typeof value === "string" ? Number(value) : NaN;
  if (!Number.isFinite(number)) throw new PaymentAuthorityError(`Invalid ${field} from Core payment authority`);
  return number;
}

function optionalString(value: unknown): string | null {
  return typeof value === "string" ? value : null;
}

function mapResult(data: unknown, operation: string): { paymentId: string; status: string; already: boolean } {
  const value = row<{ payment_id?: unknown; status?: unknown; already_recorded?: unknown; already_verified?: unknown; already_rejected?: unknown }>(data, operation);
  return {
    paymentId: requiredString(value.payment_id, "payment_id"),
    status: requiredString(value.status, "status"),
    already: Boolean(value.already_recorded ?? value.already_verified ?? value.already_rejected),
  };
}

async function call<T>(fn: string, args: Record<string, unknown>): Promise<T> {
  const { data, error } = await db.rpc<T>(fn, args);
  if (error) throw new PaymentAuthorityError(error);
  if (data === null || data === undefined) throw new PaymentAuthorityError(`${fn} returned no governed result`);
  return data;
}

export function buildPaymentIdempotencyKey(operation: "proof" | "verify" | "reject", identity: string): string {
  const normalized = identity.trim();
  if (!normalized) throw new PaymentAuthorityError("A stable payment identity is required for idempotency");
  return `central:pf6a:${operation}:${normalized}`;
}

/** Stable, bounded correlation identity; raw receipt URLs never enter Core metadata. */
export function buildPaymentCorrelationId(operation: "proof" | "verify" | "reject", identity: string): string {
  const normalized = identity.trim();
  if (!normalized) throw new PaymentAuthorityError("A stable payment identity is required for correlation");
  let hash = 2166136261;
  for (const character of normalized) hash = Math.imul(hash ^ character.charCodeAt(0), 16777619);
  return `central:pf6a:${operation}:${(hash >>> 0).toString(16).padStart(8, "0")}`;
}

export async function recordPaymentProof(input: PaymentProofInput): Promise<PaymentProofResult> {
  assertActorId(input.actorId);
  const mapped = mapResult(await call("record_order_payment_proof_v1", {
    p_order_id: input.orderId,
    p_pi_id: input.piId,
    p_commercial_version_id: input.commercialVersionId,
    p_payment_type: input.paymentType,
    p_submitted_amount: input.submittedAmount,
    p_currency: input.currency,
    p_payment_mode: input.paymentMode ?? null,
    p_external_reference: input.externalReference ?? null,
    p_payer_reference: input.payerReference ?? null,
    p_proof_evidence_reference: input.proofEvidenceReference,
    p_source_channel: input.sourceChannel,
    p_source_reference: input.sourceReference,
    p_correlation_id: input.correlationId,
    p_idempotency_key: input.idempotencyKey,
    p_actor_id: input.actorId,
  }), "recordPaymentProof");
  return { paymentId: mapped.paymentId, status: mapped.status, alreadyRecorded: mapped.already };
}

export async function verifyPayment(input: PaymentVerificationInput): Promise<PaymentVerificationResult> {
  assertActorId(input.actorId);
  const mapped = mapResult(await call("verify_order_payment_v1", {
    p_payment_id: input.paymentId,
    p_verified_amount: input.verifiedAmount,
    p_verified_reference: input.verifiedReference ?? null,
    p_verification_evidence_reference: input.verificationEvidenceReference,
    p_reason: input.reason ?? null,
    p_correlation_id: input.correlationId,
    p_idempotency_key: input.idempotencyKey,
    p_actor_id: input.actorId,
  }), "verifyPayment");
  return { paymentId: mapped.paymentId, status: mapped.status, alreadyVerified: mapped.already };
}

export async function rejectPayment(input: PaymentRejectionInput): Promise<PaymentRejectionResult> {
  assertActorId(input.actorId);
  const mapped = mapResult(await call("reject_order_payment_v1", {
    p_payment_id: input.paymentId,
    p_reason: input.reason,
    p_correlation_id: input.correlationId,
    p_idempotency_key: input.idempotencyKey,
    p_actor_id: input.actorId,
  }), "rejectPayment");
  return { paymentId: mapped.paymentId, status: mapped.status, alreadyRejected: mapped.already };
}

export function parsePaymentFacts(value: unknown): PaymentFacts {
  const facts = row<Record<string, unknown>>(value, "getPaymentFacts");
  if (facts.payment_facts_only !== true) throw new PaymentAuthorityError("Core payment facts response is not factual-only");
  const payments = Array.isArray(facts.payments) ? facts.payments : [];
  return {
    piId: requiredString(facts.pi_id, "pi_id"),
    orderId: requiredString(facts.order_id, "order_id"),
    commercialVersionId: requiredString(facts.commercial_version_id, "commercial_version_id"),
    commercialVersionNumber: requiredNumber(facts.commercial_version_number, "commercial_version_number"),
    commercialValue: requiredNumber(facts.commercial_value, "commercial_value"),
    verifiedTotal: requiredNumber(facts.verified_total, "verified_total"),
    remainingCommercialAmount: requiredNumber(facts.remaining_commercial_amount, "remaining_commercial_amount"),
    payments: payments.map((item) => {
      const payment = item && typeof item === "object" ? item as Record<string, unknown> : {};
      return {
        paymentId: requiredString(payment.payment_id, "payment_id"),
        status: requiredString(payment.status, "payment status"),
        paymentType: requiredString(payment.payment_type, "payment type"),
        submittedAmount: requiredNumber(payment.submitted_amount, "submitted_amount"),
        verifiedAmount: payment.verified_amount == null ? null : requiredNumber(payment.verified_amount, "verified_amount"),
        currency: optionalString(payment.currency),
        paymentMode: optionalString(payment.payment_mode),
        externalReference: optionalString(payment.external_reference),
        sourceChannel: optionalString(payment.source_channel),
        sourceReference: optionalString(payment.source_reference),
        proofReceivedAt: optionalString(payment.proof_received_at),
        verifiedAt: optionalString(payment.verified_at),
        rejectedAt: optionalString(payment.rejected_at),
      };
    }),
  };
}

export async function getPaymentFacts(piId: string): Promise<PaymentFacts> {
  return parsePaymentFacts(await call("get_order_payment_facts_v1", { p_pi_id: piId }));
}

export function parsePaymentBindingRows(data: unknown): PaymentBinding {
  const rows = Array.isArray(data) ? data : [];
  if (rows.length !== 1) throw new PaymentAuthorityError("A single governed PI and commercial version are required before payment action");
  const value = rows[0] && typeof rows[0] === "object" ? rows[0] as Record<string, unknown> : {};
  return {
    piId: requiredString(value.id, "PI id"),
    orderId: requiredString(value.order_id, "order id"),
    commercialVersionId: requiredString(value.commercial_version_id, "commercial version id"),
    status: requiredString(value.status, "PI status"),
  };
}

export async function resolvePaymentBinding(orderId: string): Promise<PaymentBinding> {
  const { data, error } = await db.from("sales_order_proforma_invoice_authority_v1")
    .select("id, order_id, commercial_version_id, status")
    .eq("order_id", orderId)
    .in("status", ["READY_FOR_ISSUE", "ISSUED"])
    .order("created_at", { ascending: false })
    .limit(2);
  if (error) throw new PaymentAuthorityError(error);
  return parsePaymentBindingRows(data);
}
