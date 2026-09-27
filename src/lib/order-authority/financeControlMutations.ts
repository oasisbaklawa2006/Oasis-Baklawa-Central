import { supabase } from "@/integrations/supabase/client";
import {
  FinanceHoldReleaseAuthorityError,
  type Point80RequiredCoreRpc,
} from "@/lib/order-authority/financeHoldReleaseAuthorityClient";

type RpcError = { message: string; code?: string; details?: string; hint?: string };
type RpcClient = {
  rpc<T = unknown>(fn: string, args?: Record<string, unknown>): Promise<{ data: T | null; error: RpcError | null }>;
};

const db = supabase as unknown as RpcClient;

export type FinanceControlBinding = {
  orderId: string;
  piId: string;
  commercialVersionId: string;
};

export type FinanceControlWriteContext = {
  actorId: string;
  actorRole: string;
  reason: string;
  evidenceReference: string;
  sourceChannel?: string;
  sourceReference?: string | null;
  correlationId: string;
  idempotencyKey: string;
  expectedSourceVersion?: number | null;
  requestActorId?: string | null;
};

export type FinanceControlMutationResult = {
  eventId: string;
  alreadyApplied: boolean;
  nextStatus?: string | null;
};

function requiredString(value: unknown, field: string): string {
  if (typeof value !== "string" || value.trim() === "") {
    throw new FinanceHoldReleaseAuthorityError(`${field} is required`, { code: "validation_failed" });
  }
  return value.trim();
}

function bounded(value: string, field: string): string {
  const normalized = requiredString(value, field);
  if (normalized.length > 256) {
    throw new FinanceHoldReleaseAuthorityError(`${field} exceeds Core evidence limit`, { code: "validation_failed" });
  }
  return normalized;
}

function actor(actorId: string): string {
  return bounded(actorId, "authenticated actor");
}

function row(data: unknown, operation: string): Record<string, unknown> {
  const value = Array.isArray(data) ? data[0] : data;
  if (!value || typeof value !== "object") {
    throw new FinanceHoldReleaseAuthorityError(`${operation} returned no governed result`, { code: "unavailable" });
  }
  return value as Record<string, unknown>;
}

function optionalString(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function corePrerequisite(rpc: Point80RequiredCoreRpc, action: string): FinanceHoldReleaseAuthorityError {
  return new FinanceHoldReleaseAuthorityError(
    `Core prerequisite missing for ${action}: deploy and protect ${rpc} in oasis-supabase-core before Central may mutate finance hold/release/reversal/second-approval authority.`,
    { code: "core_prerequisite_missing", prerequisite: rpc },
  );
}

function isMissingRpcError(error: RpcError): boolean {
  const msg = error.message.toLowerCase();
  return (
    msg.includes("schema cache") ||
    msg.includes("could not find the function") ||
    msg.includes("does not exist") ||
    error.code === "PGRST202" ||
    error.code === "42883"
  );
}

async function callCoreMutation(
  rpc: Point80RequiredCoreRpc,
  action: string,
  args: Record<string, unknown>,
): Promise<FinanceControlMutationResult> {
  const { data, error } = await db.rpc(rpc, args);
  if (error) {
    if (isMissingRpcError(error)) throw corePrerequisite(rpc, action);
    const msg = error.message.toLowerCase();
    if (msg.includes("stale") || msg.includes("version")) {
      throw new FinanceHoldReleaseAuthorityError(error.message, { code: "stale_version" });
    }
    if (msg.includes("self") && msg.includes("approv")) {
      throw new FinanceHoldReleaseAuthorityError(error.message, { code: "self_approval_denied" });
    }
    throw new FinanceHoldReleaseAuthorityError(error.message, { code: "unavailable" });
  }
  const value = row(data, action);
  return {
    eventId: requiredString(value.event_id ?? value.control_event_id, "event id"),
    alreadyApplied: value.already_applied === true || value.already_decided === true,
    nextStatus: optionalString(value.next_status),
  };
}

export async function placeFinanceHold(input: {
  binding: FinanceControlBinding;
  holdType: string;
  ctx: FinanceControlWriteContext;
}): Promise<FinanceControlMutationResult> {
  actor(input.ctx.actorId);
  return callCoreMutation("place_finance_hold_v1", "place finance hold", {
    p_order_id: bounded(input.binding.orderId, "order id"),
    p_pi_id: bounded(input.binding.piId, "PI id"),
    p_commercial_version_id: bounded(input.binding.commercialVersionId, "commercial version id"),
    p_hold_type: bounded(input.holdType, "hold type"),
    p_reason: bounded(input.ctx.reason, "reason"),
    p_evidence_reference: bounded(input.ctx.evidenceReference, "evidence reference"),
    p_source_channel: bounded(input.ctx.sourceChannel ?? "CENTRAL", "source channel"),
    p_source_reference: input.ctx.sourceReference?.trim() || null,
    p_expected_source_version: input.ctx.expectedSourceVersion ?? null,
    p_correlation_id: bounded(input.ctx.correlationId, "correlation id"),
    p_idempotency_key: bounded(input.ctx.idempotencyKey, "idempotency key"),
    p_actor_id: input.ctx.actorId,
  });
}

export async function releaseFinanceHold(input: {
  binding: FinanceControlBinding;
  holdEventId: string;
  ctx: FinanceControlWriteContext;
}): Promise<FinanceControlMutationResult> {
  actor(input.ctx.actorId);
  return callCoreMutation("release_finance_hold_v1", "release finance hold", {
    p_order_id: bounded(input.binding.orderId, "order id"),
    p_pi_id: bounded(input.binding.piId, "PI id"),
    p_commercial_version_id: bounded(input.binding.commercialVersionId, "commercial version id"),
    p_hold_event_id: bounded(input.holdEventId, "hold event id"),
    p_reason: bounded(input.ctx.reason, "reason"),
    p_evidence_reference: bounded(input.ctx.evidenceReference, "evidence reference"),
    p_source_channel: bounded(input.ctx.sourceChannel ?? "CENTRAL", "source channel"),
    p_source_reference: input.ctx.sourceReference?.trim() || null,
    p_expected_source_version: input.ctx.expectedSourceVersion ?? null,
    p_correlation_id: bounded(input.ctx.correlationId, "correlation id"),
    p_idempotency_key: bounded(input.ctx.idempotencyKey, "idempotency key"),
    p_actor_id: input.ctx.actorId,
  });
}

export async function requestFinanceReversal(input: {
  binding: FinanceControlBinding;
  originalEventId: string;
  ctx: FinanceControlWriteContext;
}): Promise<FinanceControlMutationResult> {
  actor(input.ctx.actorId);
  return callCoreMutation("request_finance_reversal_v1", "request finance reversal", {
    p_order_id: bounded(input.binding.orderId, "order id"),
    p_pi_id: bounded(input.binding.piId, "PI id"),
    p_commercial_version_id: bounded(input.binding.commercialVersionId, "commercial version id"),
    p_original_event_id: bounded(input.originalEventId, "original event id"),
    p_reason: bounded(input.ctx.reason, "reason"),
    p_evidence_reference: bounded(input.ctx.evidenceReference, "evidence reference"),
    p_source_channel: bounded(input.ctx.sourceChannel ?? "CENTRAL", "source channel"),
    p_source_reference: input.ctx.sourceReference?.trim() || null,
    p_expected_source_version: input.ctx.expectedSourceVersion ?? null,
    p_correlation_id: bounded(input.ctx.correlationId, "correlation id"),
    p_idempotency_key: bounded(input.ctx.idempotencyKey, "idempotency key"),
    p_actor_id: input.ctx.actorId,
  });
}

export async function completeFinanceReversal(input: {
  binding: FinanceControlBinding;
  reversalRequestId: string;
  ctx: FinanceControlWriteContext;
}): Promise<FinanceControlMutationResult> {
  actor(input.ctx.actorId);
  return callCoreMutation("complete_finance_reversal_v1", "complete finance reversal", {
    p_order_id: bounded(input.binding.orderId, "order id"),
    p_pi_id: bounded(input.binding.piId, "PI id"),
    p_commercial_version_id: bounded(input.binding.commercialVersionId, "commercial version id"),
    p_reversal_request_id: bounded(input.reversalRequestId, "reversal request id"),
    p_reason: bounded(input.ctx.reason, "reason"),
    p_evidence_reference: bounded(input.ctx.evidenceReference, "evidence reference"),
    p_source_channel: bounded(input.ctx.sourceChannel ?? "CENTRAL", "source channel"),
    p_source_reference: input.ctx.sourceReference?.trim() || null,
    p_expected_source_version: input.ctx.expectedSourceVersion ?? null,
    p_correlation_id: bounded(input.ctx.correlationId, "correlation id"),
    p_idempotency_key: bounded(input.ctx.idempotencyKey, "idempotency key"),
    p_actor_id: input.ctx.actorId,
  });
}

export async function requestFinanceSecondApproval(input: {
  binding: FinanceControlBinding;
  releaseEventId: string;
  ctx: FinanceControlWriteContext;
}): Promise<FinanceControlMutationResult> {
  actor(input.ctx.actorId);
  return callCoreMutation("request_finance_second_approval_v1", "request finance second approval", {
    p_order_id: bounded(input.binding.orderId, "order id"),
    p_pi_id: bounded(input.binding.piId, "PI id"),
    p_commercial_version_id: bounded(input.binding.commercialVersionId, "commercial version id"),
    p_release_event_id: bounded(input.releaseEventId, "release event id"),
    p_reason: bounded(input.ctx.reason, "reason"),
    p_evidence_reference: bounded(input.ctx.evidenceReference, "evidence reference"),
    p_source_channel: bounded(input.ctx.sourceChannel ?? "CENTRAL", "source channel"),
    p_source_reference: input.ctx.sourceReference?.trim() || null,
    p_expected_source_version: input.ctx.expectedSourceVersion ?? null,
    p_correlation_id: bounded(input.ctx.correlationId, "correlation id"),
    p_idempotency_key: bounded(input.ctx.idempotencyKey, "idempotency key"),
    p_actor_id: input.ctx.actorId,
  });
}

export async function decideFinanceSecondApproval(input: {
  approvalRequestId: string;
  decision: "APPROVED" | "REJECTED";
  ctx: FinanceControlWriteContext;
}): Promise<FinanceControlMutationResult> {
  actor(input.ctx.actorId);
  return callCoreMutation("decide_finance_second_approval_v1", "decide finance second approval", {
    p_approval_request_id: bounded(input.approvalRequestId, "approval request id"),
    p_decision: input.decision,
    p_reason: bounded(input.ctx.reason, "reason"),
    p_evidence_reference: bounded(input.ctx.evidenceReference, "evidence reference"),
    p_source_channel: bounded(input.ctx.sourceChannel ?? "CENTRAL", "source channel"),
    p_source_reference: input.ctx.sourceReference?.trim() || null,
    p_correlation_id: bounded(input.ctx.correlationId, "correlation id"),
    p_idempotency_key: bounded(input.ctx.idempotencyKey, "idempotency key"),
    p_actor_id: input.ctx.actorId,
  });
}
