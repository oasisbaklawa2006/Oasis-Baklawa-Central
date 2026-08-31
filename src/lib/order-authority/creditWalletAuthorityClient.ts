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

export class CreditWalletAuthorityError extends Error {
  readonly code?: string;
  readonly details?: string;

  constructor(error: RpcError | string) {
    super(typeof error === "string" ? error : error.message);
    this.name = "CreditWalletAuthorityError";
    if (typeof error !== "string") {
      this.code = error.code;
      this.details = error.details;
    }
  }
}

export type WalletDirection = "credit" | "debit";
export type CreditType = "short_term_so" | "long_term_limit";
export type WalletBinding = { piId: string; orderId: string; commercialVersionId: string; status: string };

export type WalletEntryInput = {
  companyId: string;
  direction: WalletDirection;
  amount: number;
  currency: string;
  orderId?: string | null;
  proformaInvoiceId?: string | null;
  commercialVersionId?: string | null;
  sourceChannel: string;
  sourceReference?: string | null;
  reason: string;
  correlationId: string;
  idempotencyKey: string;
  actorId: string;
};
export type WalletEntryResult = { entryId: string; balance: number; alreadyApplied: boolean };

export type CreditRequestInput = {
  companyId: string;
  orderId: string;
  proformaInvoiceId: string;
  commercialVersionId: string;
  creditType: CreditType;
  requestedAmount: number;
  sourceChannel: string;
  sourceReference?: string | null;
  reason: string;
  correlationId: string;
  idempotencyKey: string;
  expiresAt?: string | null;
  actorId: string;
};
export type CreditRequestResult = { requestId: string; status: string; alreadyRequested: boolean };

export type CreditDecisionInput = {
  requestId: string;
  approve: boolean;
  reason: string;
  sourceChannel: string;
  correlationId: string;
  idempotencyKey: string;
  actorId: string;
};
export type CreditDecisionResult = { requestId: string; status: string; alreadyDecided: boolean };

export type CreditExposureFacts = Record<string, unknown> & {
  company_id: string;
  order_id: string;
  pi_id: string;
  commercial_version_id: string;
  exposure_facts_only: true;
  clearance_decision: null;
};

function requiredString(value: unknown, field: string): string {
  if (typeof value !== "string" || value.trim() === "") throw new CreditWalletAuthorityError(`Invalid ${field} from Core credit/wallet authority`);
  return value;
}

function bounded(value: string, field: string): string {
  const normalized = requiredString(value, field).trim();
  if (normalized.length > 256) throw new CreditWalletAuthorityError(`${field} exceeds the Core evidence limit`);
  return normalized;
}

function stableIdentity(value: string, purpose: string): string {
  const normalized = value.trim();
  if (!normalized) throw new CreditWalletAuthorityError(`A stable PF-6B identity is required for ${purpose}`);
  return normalized;
}

function actor(actorId: string): string { return bounded(actorId, "authenticated actor"); }

function requiredNumber(value: unknown, field: string): number {
  const n = typeof value === "number" ? value : typeof value === "string" ? Number(value) : NaN;
  if (!Number.isFinite(n)) throw new CreditWalletAuthorityError(`Invalid ${field} from Core credit/wallet authority`);
  return n;
}

function assertAmount(value: number): void {
  if (!Number.isFinite(value) || value <= 0) throw new CreditWalletAuthorityError("A positive finite amount is required for PF-6B authority");
}

function row<T>(data: unknown, operation: string): T {
  const value = Array.isArray(data) ? data[0] : data;
  if (!value || typeof value !== "object") throw new CreditWalletAuthorityError(`${operation} returned no governed result`);
  return value as T;
}

async function call<T>(fn: string, args: Record<string, unknown>): Promise<T> {
  const { data, error } = await db.rpc<T>(fn, args);
  if (error) throw new CreditWalletAuthorityError(error);
  if (data === null || data === undefined) throw new CreditWalletAuthorityError(`${fn} returned no governed result`);
  return data;
}

async function sha256Hex(value: string): Promise<string> {
  const subtle = globalThis.crypto?.subtle;
  if (!subtle) throw new CreditWalletAuthorityError("Web Crypto SHA-256 is unavailable for PF-6B identity");
  const digest = await subtle.digest("SHA-256", new TextEncoder().encode(value));
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, "0")).join("");
}

export async function buildCreditWalletIdempotencyKey(operation: string, identity: string): Promise<string> {
  return `central:pf6b:${bounded(operation, "operation").toLowerCase()}:${await sha256Hex(stableIdentity(identity, "idempotency"))}`;
}

export async function buildCreditWalletCorrelationId(operation: string, identity: string): Promise<string> {
  return `central:pf6b:${bounded(operation, "operation").toLowerCase()}:${await sha256Hex(`correlation:${stableIdentity(identity, "correlation")}`)}`;
}

export function buildWalletIdentity(input: Omit<WalletEntryInput, "correlationId" | "idempotencyKey" | "actorId">): string {
  assertAmount(input.amount);
  return JSON.stringify([
    bounded(input.companyId, "company id"), input.direction, input.amount, bounded(input.currency, "currency").toUpperCase(),
    input.orderId ?? null, input.proformaInvoiceId ?? null, input.commercialVersionId ?? null,
    bounded(input.sourceChannel, "source channel"), input.sourceReference?.trim() || null, bounded(input.reason, "reason"),
  ]);
}

export function buildCreditRequestIdentity(input: Omit<CreditRequestInput, "correlationId" | "idempotencyKey" | "actorId">): string {
  assertAmount(input.requestedAmount);
  return JSON.stringify([
    bounded(input.companyId, "company id"), bounded(input.orderId, "order id"), bounded(input.proformaInvoiceId, "PI id"),
    bounded(input.commercialVersionId, "commercial version id"), input.creditType, input.requestedAmount,
    bounded(input.sourceChannel, "source channel"), input.sourceReference?.trim() || null, bounded(input.reason, "reason"), input.expiresAt ?? null,
  ]);
}

export async function recordWalletEntry(input: WalletEntryInput): Promise<WalletEntryResult> {
  assertAmount(input.amount);
  const result = row<{ entry_id?: unknown; balance?: unknown; already_applied?: unknown }>(await call("record_wallet_entry_v1", {
    p_company_id: bounded(input.companyId, "company id"), p_direction: input.direction, p_amount: input.amount,
    p_currency: bounded(input.currency, "currency").toUpperCase(), p_order_id: input.orderId ?? null,
    p_proforma_invoice_id: input.proformaInvoiceId ?? null, p_commercial_version_id: input.commercialVersionId ?? null,
    p_source_channel: bounded(input.sourceChannel, "source channel"), p_source_reference: input.sourceReference?.trim() || null,
    p_reason: bounded(input.reason, "reason"), p_correlation_id: bounded(input.correlationId, "correlation id"),
    p_idempotency_key: bounded(input.idempotencyKey, "idempotency key"), p_actor_id: actor(input.actorId),
  }), "recordWalletEntry");
  return { entryId: requiredString(result.entry_id, "entry id"), balance: requiredNumber(result.balance, "wallet balance"), alreadyApplied: Boolean(result.already_applied) };
}

export async function getWalletBalance(companyId: string): Promise<number> {
  return requiredNumber(await call("get_wallet_balance_v1", { p_company_id: bounded(companyId, "company id") }), "wallet balance");
}

export async function requestCredit(input: CreditRequestInput): Promise<CreditRequestResult> {
  assertAmount(input.requestedAmount);
  const result = row<{ request_id?: unknown; status?: unknown; already_requested?: unknown }>(await call("request_credit_authority_v1", {
    p_company_id: bounded(input.companyId, "company id"), p_order_id: bounded(input.orderId, "order id"),
    p_proforma_invoice_id: bounded(input.proformaInvoiceId, "PI id"), p_commercial_version_id: bounded(input.commercialVersionId, "commercial version id"),
    p_credit_type: input.creditType, p_requested_amount: input.requestedAmount, p_source_channel: bounded(input.sourceChannel, "source channel"),
    p_source_reference: input.sourceReference?.trim() || null, p_reason: bounded(input.reason, "reason"),
    p_correlation_id: bounded(input.correlationId, "correlation id"), p_idempotency_key: bounded(input.idempotencyKey, "idempotency key"),
    p_expires_at: input.expiresAt ?? null, p_actor_id: actor(input.actorId),
  }), "requestCredit");
  return { requestId: requiredString(result.request_id, "request id"), status: requiredString(result.status, "credit status"), alreadyRequested: Boolean(result.already_requested) };
}

export async function decideCreditRequest(input: CreditDecisionInput): Promise<CreditDecisionResult> {
  const result = row<{ request_id?: unknown; status?: unknown; already_decided?: unknown }>(await call("decide_credit_request_v1", {
    p_request_id: bounded(input.requestId, "request id"), p_approve: input.approve, p_reason: bounded(input.reason, "reason"),
    p_source_channel: bounded(input.sourceChannel, "source channel"), p_correlation_id: bounded(input.correlationId, "correlation id"),
    p_idempotency_key: bounded(input.idempotencyKey, "idempotency key"), p_actor_id: actor(input.actorId),
  }), "decideCreditRequest");
  return { requestId: requiredString(result.request_id, "request id"), status: requiredString(result.status, "credit status"), alreadyDecided: Boolean(result.already_decided) };
}

export function parseCreditExposureFacts(value: unknown): CreditExposureFacts {
  const facts = row<Record<string, unknown>>(value, "getCreditExposureFacts");
  if (facts.exposure_facts_only !== true || facts.clearance_decision !== null) throw new CreditWalletAuthorityError("Core returned non-factual credit exposure data");
  return {
    ...facts,
    company_id: requiredString(facts.company_id, "company id"), order_id: requiredString(facts.order_id, "order id"),
    pi_id: requiredString(facts.pi_id, "PI id"), commercial_version_id: requiredString(facts.commercial_version_id, "commercial version id"),
    exposure_facts_only: true, clearance_decision: null,
  };
}

export async function getCreditExposureFacts(companyId: string, piId: string, commercialVersionId: string): Promise<CreditExposureFacts> {
  return parseCreditExposureFacts(await call("get_credit_exposure_facts_v1", {
    p_company_id: bounded(companyId, "company id"), p_pi_id: bounded(piId, "PI id"), p_commercial_version_id: bounded(commercialVersionId, "commercial version id"),
  }));
}

export async function resolveCreditBinding(orderId: string): Promise<WalletBinding> {
  const { data, error } = await db.from("sales_order_proforma_invoice_authority_v1")
    .select("id, order_id, commercial_version_id, status")
    .eq("order_id", bounded(orderId, "order id"))
    .in("status", ["READY_FOR_ISSUE", "ISSUED"])
    .order("created_at", { ascending: false }).limit(2);
  if (error) throw new CreditWalletAuthorityError(error);
  const rows = Array.isArray(data) ? data : [];
  if (rows.length !== 1) throw new CreditWalletAuthorityError("A single governed PI and commercial version are required before PF-6B action");
  const value = rows[0] as Record<string, unknown>;
  return { piId: requiredString(value.id, "PI id"), orderId: requiredString(value.order_id, "order id"), commercialVersionId: requiredString(value.commercial_version_id, "commercial version id"), status: requiredString(value.status, "PI status") };
}
