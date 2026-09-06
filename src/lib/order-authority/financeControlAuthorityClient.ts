import { supabase } from "@/integrations/supabase/client";
import {
  decideFinanceOperationsClearance,
  getFinanceOperationsClearanceFacts,
  type FinanceOperationsClearanceFacts,
} from "@/lib/order-authority/financeClearanceAuthorityClient";
import { decideFinanceDispatchClearance } from "@/lib/order-authority/financeExitAuthorityClient";
import { resolvePaymentBinding } from "@/lib/order-authority/paymentAuthorityClient";
import {
  POINT80_REQUIRED_CORE_RPCS,
  type Point80RequiredCoreRpc,
} from "@/lib/order-authority/financeControlSurfaceCensus";

type RpcError = { message: string; code?: string; details?: string; hint?: string };
type RpcClient = {
  rpc<T = unknown>(fn: string, args?: Record<string, unknown>): Promise<{ data: T | null; error: RpcError | null }>;
};

const db = supabase as unknown as RpcClient;

export class FinanceControlAuthorityError extends Error {
  readonly code:
    | "core_prerequisite"
    | "authority_denied"
    | "validation_failed"
    | "stale_version"
    | "self_approval"
    | "idempotency"
    | "unavailable";
  readonly prerequisite?: Point80RequiredCoreRpc | Point80RequiredCoreRpc[];
  readonly details?: string;

  constructor(
    code: FinanceControlAuthorityError["code"],
    message: string,
    options?: { prerequisite?: Point80RequiredCoreRpc | Point80RequiredCoreRpc[]; details?: string },
  ) {
    super(message);
    this.name = "FinanceControlAuthorityError";
    this.code = code;
    this.prerequisite = options?.prerequisite;
    this.details = options?.details;
  }
}

export type FinanceControlDecision = "GRANTED" | "DENIED" | "REVOKED";
export type FinanceSecondApprovalDecision = "APPROVED" | "REJECTED";

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
  originalEventId?: string | null;
  requestActorId?: string | null;
  approvalRequestId?: string | null;
};

export type FinanceControlFacts = {
  orderId: string;
  piId: string;
  commercialVersionId: string;
  sourceVersion: number;
  openHoldTypes: string[];
  activeHoldEventIds: string[];
  latestReleaseDecision: FinanceControlDecision | null;
  pendingReversalRequestId: string | null;
  pendingSecondApprovalRequestId: string | null;
  secondApprovalRequired: boolean;
  controlFactsOnly: true;
};

export type FinanceControlMutationResult = {
  eventId: string;
  alreadyApplied: boolean;
  nextStatus?: string | null;
};

function requiredString(value: unknown, field: string): string {
  if (typeof value !== "string" || value.trim() === "") {
    throw new FinanceControlAuthorityError("validation_failed", `${field} is required`);
  }
  return value.trim();
}

function bounded(value: string, field: string): string {
  const normalized = requiredString(value, field);
  if (normalized.length > 256) {
    throw new FinanceControlAuthorityError("validation_failed", `${field} exceeds Core evidence limit`);
  }
  return normalized;
}

function actor(actorId: string): string {
  return bounded(actorId, "authenticated actor");
}

function row(data: unknown, operation: string): Record<string, unknown> {
  const value = Array.isArray(data) ? data[0] : data;
  if (!value || typeof value !== "object") {
    throw new FinanceControlAuthorityError("unavailable", `${operation} returned no governed result`);
  }
  return value as Record<string, unknown>;
}

function optionalString(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function requiredNumber(value: unknown, field: string): number {
  const number = typeof value === "number" ? value : typeof value === "string" ? Number(value) : NaN;
  if (!Number.isFinite(number)) {
    throw new FinanceControlAuthorityError("validation_failed", `Invalid ${field} from Core finance control authority`);
  }
  return number;
}

function corePrerequisite(
  rpc: Point80RequiredCoreRpc,
  action: string,
): FinanceControlAuthorityError {
  return new FinanceControlAuthorityError(
    "core_prerequisite",
    `Core prerequisite missing for ${action}: deploy and protect ${rpc} in oasis-supabase-core before Central may mutate finance hold/release/reversal/second-approval authority.`,
    { prerequisite: rpc },
  );
}

async function sha256Hex(value: string): Promise<string> {
  const subtle = globalThis.crypto?.subtle;
  if (!subtle) {
    throw new FinanceControlAuthorityError("unavailable", "Web Crypto SHA-256 is unavailable for finance control identity");
  }
  const digest = await subtle.digest("SHA-256", new TextEncoder().encode(value));
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, "0")).join("");
}

export function buildFinanceControlIdentity(parts: unknown[]): string {
  return JSON.stringify(parts);
}

export async function buildFinanceControlIdempotencyKey(scope: string, identity: string): Promise<string> {
  return `central:pf6d:${bounded(scope, "scope").toLowerCase()}:${await sha256Hex(`idempotency:${identity}`)}`;
}

export async function buildFinanceControlCorrelationId(scope: string, identity: string): Promise<string> {
  return `central:pf6d:${bounded(scope, "scope").toLowerCase()}:${await sha256Hex(`correlation:${identity}`)}`;
}

export function assertDualControl(requestActorId: string | null | undefined, decidingActorId: string): void {
  const requester = requestActorId?.trim();
  const decider = decidingActorId.trim();
  if (requester && requester === decider) {
    throw new FinanceControlAuthorityError(
      "self_approval",
      "Second approval / reversal completion requires a different actor from the requesting actor.",
    );
  }
}

export function assertSourceVersion(
  expected: number | null | undefined,
  actual: number | null | undefined,
): void {
  if (expected == null || actual == null) return;
  if (expected !== actual) {
    throw new FinanceControlAuthorityError(
      "stale_version",
      `Stale finance control source version: expected ${expected}, Core returned ${actual}.`,
    );
  }
}

export function parseFinanceControlFacts(data: unknown): FinanceControlFacts {
  const facts = row(data, "getFinanceControlFacts");
  if (facts.control_facts_only !== true) {
    throw new FinanceControlAuthorityError(
      "validation_failed",
      "Core finance control facts did not preserve control_facts_only separation",
    );
  }
  const latestReleaseDecision = optionalString(facts.latest_release_decision);
  return {
    orderId: requiredString(facts.order_id, "order_id"),
    piId: requiredString(facts.pi_id, "pi_id"),
    commercialVersionId: requiredString(facts.commercial_version_id, "commercial_version_id"),
    sourceVersion: requiredNumber(facts.source_version, "source_version"),
    openHoldTypes: Array.isArray(facts.open_hold_types)
      ? facts.open_hold_types.filter((value): value is string => typeof value === "string")
      : [],
    activeHoldEventIds: Array.isArray(facts.active_hold_event_ids)
      ? facts.active_hold_event_ids.filter((value): value is string => typeof value === "string")
      : [],
    latestReleaseDecision:
      latestReleaseDecision === "GRANTED" ||
      latestReleaseDecision === "DENIED" ||
      latestReleaseDecision === "REVOKED"
        ? latestReleaseDecision
        : null,
    pendingReversalRequestId: optionalString(facts.pending_reversal_request_id),
    pendingSecondApprovalRequestId: optionalString(facts.pending_second_approval_request_id),
    secondApprovalRequired: facts.second_approval_required === true,
    controlFactsOnly: true,
  };
}

export async function probeFinanceControlCoreRpc(
  rpc: Point80RequiredCoreRpc,
): Promise<boolean> {
  const { error } = await db.rpc(rpc, {});
  if (!error) return true;
  const msg = error.message.toLowerCase();
  if (
    msg.includes("schema cache") ||
    msg.includes("could not find the function") ||
    msg.includes("does not exist") ||
    error.code === "PGRST202" ||
    error.code === "42883"
  ) {
    return false;
  }
  return true;
}

export async function probeFinanceControlAuthority(): Promise<{
  available: boolean;
  missingCoreRpcs: Point80RequiredCoreRpc[];
}> {
  const missingCoreRpcs: Point80RequiredCoreRpc[] = [];
  for (const rpc of POINT80_REQUIRED_CORE_RPCS) {
    const ok = await probeFinanceControlCoreRpc(rpc).catch(() => false);
    if (!ok) missingCoreRpcs.push(rpc);
  }
  return { available: missingCoreRpcs.length === 0, missingCoreRpcs };
}

export function formatFinanceControlPrerequisite(missing: Point80RequiredCoreRpc[]): string {
  return `Core prerequisite: deploy and protect ${missing.join(", ")} in oasis-supabase-core (Point 80 PF-6D finance control authority). Central must not create shadow hold/release/reversal truth.`;
}

export async function resolveFinanceControlBinding(orderId: string): Promise<FinanceControlBinding> {
  const binding = await resolvePaymentBinding(orderId);
  return {
    orderId: binding.orderId,
    piId: binding.piId,
    commercialVersionId: binding.commercialVersionId,
  };
}

export async function getFinanceControlFacts(
  binding: FinanceControlBinding,
): Promise<FinanceControlFacts> {
  const { data, error } = await db.rpc("get_finance_control_facts_v1", {
    p_order_id: bounded(binding.orderId, "order id"),
    p_pi_id: bounded(binding.piId, "PI id"),
    p_commercial_version_id: bounded(binding.commercialVersionId, "commercial version id"),
  });
  if (error) {
    const msg = error.message.toLowerCase();
    if (
      msg.includes("schema cache") ||
      msg.includes("could not find the function") ||
      msg.includes("does not exist")
    ) {
      throw corePrerequisite("get_finance_control_facts_v1", "read finance control facts");
    }
    throw new FinanceControlAuthorityError("unavailable", error.message, { details: error.details });
  }
  return parseFinanceControlFacts(data);
}

async function callCoreMutation(
  rpc: Point80RequiredCoreRpc,
  action: string,
  args: Record<string, unknown>,
): Promise<FinanceControlMutationResult> {
  const { data, error } = await db.rpc(rpc, args);
  if (error) {
    const msg = error.message.toLowerCase();
    if (
      msg.includes("schema cache") ||
      msg.includes("could not find the function") ||
      msg.includes("does not exist")
    ) {
      throw corePrerequisite(rpc, action);
    }
    if (msg.includes("stale") || msg.includes("version")) {
      throw new FinanceControlAuthorityError("stale_version", error.message, { details: error.details });
    }
    if (msg.includes("self") && msg.includes("approv")) {
      throw new FinanceControlAuthorityError("self_approval", error.message, { details: error.details });
    }
    if (msg.includes("idempot")) {
      throw new FinanceControlAuthorityError("idempotency", error.message, { details: error.details });
    }
    throw new FinanceControlAuthorityError("unavailable", error.message, { details: error.details });
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
  const originalEventId = bounded(input.originalEventId, "original event id");
  return callCoreMutation("request_finance_reversal_v1", "request finance reversal", {
    p_order_id: bounded(input.binding.orderId, "order id"),
    p_pi_id: bounded(input.binding.piId, "PI id"),
    p_commercial_version_id: bounded(input.binding.commercialVersionId, "commercial version id"),
    p_original_event_id: originalEventId,
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
  assertDualControl(input.ctx.requestActorId, input.ctx.actorId);
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
  decision: FinanceSecondApprovalDecision;
  ctx: FinanceControlWriteContext;
}): Promise<FinanceControlMutationResult> {
  actor(input.ctx.actorId);
  assertDualControl(input.ctx.requestActorId, input.ctx.actorId);
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

export async function revokeFinanceOperationsClearance(input: {
  binding: FinanceControlBinding;
  ctx: FinanceControlWriteContext;
}): Promise<{ clearanceEventId: string; alreadyDecided: boolean }> {
  actor(input.ctx.actorId);
  assertDualControl(input.ctx.requestActorId, input.ctx.actorId);
  const facts: FinanceOperationsClearanceFacts = await getFinanceOperationsClearanceFacts(
    input.binding.orderId,
    input.binding.piId,
    input.binding.commercialVersionId,
  );
  if (!facts.latestClearanceEventId) {
    throw new FinanceControlAuthorityError(
      "validation_failed",
      "Cannot revoke operations clearance without immutable latest_clearance_event_id from Core.",
    );
  }
  const result = await decideFinanceOperationsClearance({
    orderId: input.binding.orderId,
    piId: input.binding.piId,
    commercialVersionId: input.binding.commercialVersionId,
    decision: "REVOKED",
    reason: input.ctx.reason,
    evidenceReference: input.ctx.evidenceReference,
    sourceChannel: input.ctx.sourceChannel ?? "CENTRAL",
    sourceReference: input.ctx.sourceReference ?? facts.latestClearanceEventId,
    correlationId: input.ctx.correlationId,
    idempotencyKey: input.ctx.idempotencyKey,
    actorId: input.ctx.actorId,
  });
  return { clearanceEventId: result.clearanceEventId, alreadyDecided: result.alreadyDecided };
}

export async function revokeFinanceDispatchClearance(input: {
  finalInvoiceId: string;
  ctx: FinanceControlWriteContext;
}): Promise<Record<string, unknown>> {
  actor(input.ctx.actorId);
  assertDualControl(input.ctx.requestActorId, input.ctx.actorId);
  return decideFinanceDispatchClearance({
    finalInvoiceId: input.finalInvoiceId,
    decision: "REVOKED",
    reason: input.ctx.reason,
    evidenceReference: input.ctx.evidenceReference,
    actorId: input.ctx.actorId,
  });
}

export function mapClearanceFactsToControlProjection(
  facts: FinanceOperationsClearanceFacts,
): Pick<FinanceControlFacts, "latestReleaseDecision" | "secondApprovalRequired"> {
  return {
    latestReleaseDecision: facts.latestClearanceDecision,
    secondApprovalRequired: facts.latestClearanceDecision === "GRANTED",
  };
}
