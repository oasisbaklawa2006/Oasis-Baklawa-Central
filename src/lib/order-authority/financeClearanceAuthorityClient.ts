import { supabase } from "@/integrations/supabase/client";

type RpcError = { message: string; code?: string; details?: string; hint?: string };
type RpcClient = {
  rpc<T = unknown>(fn: string, args: Record<string, unknown>): Promise<{ data: T | null; error: RpcError | null }>;
};

const db = supabase as unknown as RpcClient;

export class FinanceClearanceAuthorityError extends Error {
  readonly code?: string;
  readonly details?: string;

  constructor(error: RpcError | string) {
    const message = typeof error === "string" ? error : error.message;
    super(message);
    this.name = "FinanceClearanceAuthorityError";
    if (typeof error !== "string") {
      this.code = error.code;
      this.details = error.details;
    }
  }
}

export type FinanceOperationsClearanceFacts = {
  orderId: string;
  companyId: string;
  piId: string;
  commercialVersionId: string;
  commercialValue: number;
  requiredAdvance: number;
  verifiedPaymentAmount: number;
  walletAppliedAmount: number;
  approvedCreditAmount: number;
  coveredAmount: number;
  eligibleForOperationsClearance: boolean;
  latestClearanceEventId: string | null;
  latestClearanceDecision: "GRANTED" | "DENIED" | "REVOKED" | null;
};

export type FinanceOperationsDecisionInput = {
  orderId: string;
  piId: string;
  commercialVersionId: string;
  decision: "GRANTED" | "DENIED" | "REVOKED";
  reason: string;
  evidenceReference: string;
  sourceChannel: string;
  sourceReference?: string | null;
  correlationId: string;
  idempotencyKey: string;
  actorId: string;
};

export type FinanceOperationsDecisionResult = {
  clearanceEventId: string;
  decision: "GRANTED" | "DENIED" | "REVOKED";
  alreadyDecided: boolean;
};

function row<T>(data: unknown, operation: string): T {
  const value = Array.isArray(data) ? data[0] : data;
  if (!value || typeof value !== "object") {
    throw new FinanceClearanceAuthorityError(`${operation} returned no governed result`);
  }
  return value as T;
}

function requiredString(value: unknown, field: string): string {
  if (typeof value !== "string" || value.trim() === "") {
    throw new FinanceClearanceAuthorityError(`Invalid ${field} from Core Finance clearance authority`);
  }
  return value.trim();
}

function requiredNumber(value: unknown, field: string): number {
  const number = typeof value === "number" ? value : typeof value === "string" ? Number(value) : NaN;
  if (!Number.isFinite(number)) {
    throw new FinanceClearanceAuthorityError(`Invalid ${field} from Core Finance clearance authority`);
  }
  return number;
}

function optionalString(value: unknown): string | null {
  return typeof value === "string" && value.trim() !== "" ? value.trim() : null;
}

async function call<T>(fn: string, args: Record<string, unknown>): Promise<T> {
  const { data, error } = await db.rpc<T>(fn, args);
  if (error) throw new FinanceClearanceAuthorityError(error);
  if (data === null || data === undefined) {
    throw new FinanceClearanceAuthorityError(`${fn} returned no governed result`);
  }
  return data;
}

export function parseFinanceOperationsClearanceFacts(data: unknown): FinanceOperationsClearanceFacts {
  const facts = row<Record<string, unknown>>(data, "getFinanceOperationsClearanceFacts");
  if (facts.payment_verified_is_not_clearance !== true) {
    throw new FinanceClearanceAuthorityError("Core Finance facts did not preserve payment-verification separation");
  }
  return {
    orderId: requiredString(facts.order_id, "order_id"),
    companyId: requiredString(facts.company_id, "company_id"),
    piId: requiredString(facts.pi_id, "pi_id"),
    commercialVersionId: requiredString(facts.commercial_version_id, "commercial_version_id"),
    commercialValue: requiredNumber(facts.commercial_value, "commercial_value"),
    requiredAdvance: requiredNumber(facts.required_advance, "required_advance"),
    verifiedPaymentAmount: requiredNumber(facts.verified_payment_amount, "verified_payment_amount"),
    walletAppliedAmount: requiredNumber(facts.wallet_applied_amount, "wallet_applied_amount"),
    approvedCreditAmount: requiredNumber(facts.approved_credit_amount, "approved_credit_amount"),
    coveredAmount: requiredNumber(facts.covered_amount, "covered_amount"),
    eligibleForOperationsClearance: facts.eligible_for_operations_clearance === true,
    latestClearanceEventId: optionalString(facts.latest_clearance_event_id),
    latestClearanceDecision: (() => {
      const value = optionalString(facts.latest_clearance_decision);
      return value === "GRANTED" || value === "DENIED" || value === "REVOKED" ? value : null;
    })(),
  };
}

export async function getFinanceOperationsClearanceFacts(
  orderId: string,
  piId: string,
  commercialVersionId: string,
): Promise<FinanceOperationsClearanceFacts> {
  return parseFinanceOperationsClearanceFacts(await call("get_finance_operations_clearance_facts_v1", {
    p_order_id: requiredString(orderId, "order id"),
    p_pi_id: requiredString(piId, "PI id"),
    p_commercial_version_id: requiredString(commercialVersionId, "commercial version id"),
  }));
}

function parseDecision(data: unknown): FinanceOperationsDecisionResult {
  const value = row<Record<string, unknown>>(data, "decideFinanceOperationsClearance");
  const decision = requiredString(value.decision, "decision");
  if (decision !== "GRANTED" && decision !== "DENIED" && decision !== "REVOKED") {
    throw new FinanceClearanceAuthorityError("Invalid decision from Core Finance clearance authority");
  }
  return {
    clearanceEventId: requiredString(value.clearance_event_id, "clearance_event_id"),
    decision,
    alreadyDecided: value.already_decided === true,
  };
}

export async function decideFinanceOperationsClearance(
  input: FinanceOperationsDecisionInput,
): Promise<FinanceOperationsDecisionResult> {
  requiredString(input.actorId, "actor id");
  return parseDecision(await call("decide_finance_operations_clearance_v1", {
    p_order_id: requiredString(input.orderId, "order id"),
    p_pi_id: requiredString(input.piId, "PI id"),
    p_commercial_version_id: requiredString(input.commercialVersionId, "commercial version id"),
    p_decision: input.decision,
    p_reason: requiredString(input.reason, "reason"),
    p_evidence_reference: requiredString(input.evidenceReference, "evidence reference"),
    p_source_channel: requiredString(input.sourceChannel, "source channel"),
    p_source_reference: input.sourceReference?.trim() || null,
    p_correlation_id: requiredString(input.correlationId, "correlation id"),
    p_idempotency_key: requiredString(input.idempotencyKey, "idempotency key"),
    p_actor_id: input.actorId,
  }));
}

async function sha256Hex(value: string): Promise<string> {
  const subtle = globalThis.crypto?.subtle;
  if (!subtle) throw new FinanceClearanceAuthorityError("Web Crypto SHA-256 is unavailable for Finance clearance identity");
  const digest = await subtle.digest("SHA-256", new TextEncoder().encode(value));
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, "0")).join("");
}

export function buildFinanceOperationsDecisionIdentity(
  facts: FinanceOperationsClearanceFacts,
  decision: "GRANTED" | "DENIED" | "REVOKED",
  reason: string,
  evidenceReference: string,
): string {
  return JSON.stringify([
    facts.orderId,
    facts.piId,
    facts.commercialVersionId,
    decision,
    requiredString(reason, "reason"),
    requiredString(evidenceReference, "evidence reference"),
    facts.requiredAdvance,
    facts.verifiedPaymentAmount,
    facts.walletAppliedAmount,
    facts.approvedCreditAmount,
    facts.coveredAmount,
  ]);
}

export async function buildFinanceOperationsIdempotencyKey(identity: string): Promise<string> {
  const normalized = requiredString(identity, "Finance clearance identity");
  return `central:pf6c:operations:${await sha256Hex(`idempotency:${normalized}`)}`;
}

export async function buildFinanceOperationsCorrelationId(identity: string): Promise<string> {
  const normalized = requiredString(identity, "Finance clearance identity");
  return `central:pf6c:operations:${await sha256Hex(`correlation:${normalized}`)}`;
}
