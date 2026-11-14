import { supabase } from "@/integrations/supabase/client";

/**
 * Client for Core's two-step Finance reversal (Core #482): request -> independent approval -> completion.
 * Core owns every control (Finance + AAL2, maker-checker, immutable financial snapshot, stale-snapshot refusal,
 * idempotency, serialisation). This client only shapes arguments, classifies Core's rejections and derives a read-only
 * status; it never decides, retries around or weakens a rejection. It does NOT call the immediate
 * reverse_finance_control_v1: while that function stays executable the two-step control is not fully enforced.
 */
export const FINANCE_TWO_STEP_REVERSAL_CORE_RPCS = [
  "request_finance_reversal_v1",
  "decide_finance_reversal_v1",
  "complete_finance_reversal_v1",
] as const;

export type FinanceReversalFailureCode =
  | "core_prerequisite_missing"
  | "not_finance_actor"
  | "aal2_required"
  | "maker_checker_denied"
  | "stale_snapshot"
  | "unsupported_scope"
  | "request_superseded"
  | "idempotency_conflict"
  | "request_already_open"
  | "already_decided"
  | "already_reversed"
  | "not_approved"
  | "rejected"
  | "target_not_reversible"
  | "not_found"
  | "evidence_required"
  | "unavailable";

export class FinanceReversalError extends Error {
  readonly code: FinanceReversalFailureCode;
  constructor(code: FinanceReversalFailureCode, message: string) {
    super(message);
    this.name = "FinanceReversalError";
    this.code = code;
  }
}

const CODE_BY_MARKER: Array<[RegExp, FinanceReversalFailureCode]> = [
  [/FINANCE_REVERSAL_MAKER_CHECKER/, "maker_checker_denied"],
  [/FINANCE_REVERSAL_SNAPSHOT_STALE/, "stale_snapshot"],
  [/FINANCE_REVERSAL_SCOPE_SNAPSHOT_UNAVAILABLE/, "unsupported_scope"],
  [/FINANCE_REVERSAL_REQUEST_SUPERSEDED/, "request_superseded"],
  [/FINANCE_CLEARANCE_AAL2_REQUIRED/, "aal2_required"],
  [/finance authority required|FINANCE_CLEARANCE_ACTOR_REQUIRED/, "not_finance_actor"],
  [/FINANCE_REVERSAL_IDEMPOTENCY_CONFLICT/, "idempotency_conflict"],
  [/FINANCE_REVERSAL_REQUEST_ALREADY_OPEN/, "request_already_open"],
  [/FINANCE_REVERSAL_ALREADY_DECIDED/, "already_decided"],
  [/FINANCE_CONTROL_ALREADY_REVERSED/, "already_reversed"],
  [/FINANCE_REVERSAL_NOT_APPROVED/, "not_approved"],
  [/FINANCE_REVERSAL_REJECTED/, "rejected"],
  [/FINANCE_REVERSAL_TARGET_NOT_REVERSIBLE/, "target_not_reversible"],
  [/FINANCE_CONTROL_EVENT_NOT_FOUND|FINANCE_REVERSAL_REQUEST_NOT_FOUND/, "not_found"],
  [/FINANCE_REVERSAL_EVIDENCE_REQUIRED/, "evidence_required"],
  [/schema cache|could not find the function|PGRST202|42883/i, "core_prerequisite_missing"],
];

export function classifyFinanceReversalFailure(error: { message?: string; code?: string }): FinanceReversalError {
  const text = `${error.code ?? ""} ${error.message ?? ""}`;
  const hit = CODE_BY_MARKER.find(([pattern]) => pattern.test(text));
  return new FinanceReversalError(hit ? hit[1] : "unavailable", hit ? (error.message ?? hit[1]) : "Finance reversal is unavailable");
}

type RpcClient = {
  rpc: (fn: string, args?: Record<string, unknown>) => Promise<{ data: unknown; error: { message?: string; code?: string } | null }>;
};

export type FinanceReversalContext = {
  actorId: string;
  reason: string;
  evidenceReference: string;
  correlationId: string;
  idempotencyKey: string;
};

function required(value: string, field: string): string {
  const trimmed = typeof value === "string" ? value.trim() : "";
  if (!trimmed) throw new FinanceReversalError("evidence_required", `${field} is required`);
  return trimmed;
}

function baseArgs(ctx: FinanceReversalContext) {
  return {
    p_reason: required(ctx.reason, "reason"),
    p_evidence_reference: required(ctx.evidenceReference, "evidence reference"),
    p_correlation_id: required(ctx.correlationId, "correlation id"),
    p_idempotency_key: required(ctx.idempotencyKey, "idempotency key"),
    p_actor_id: required(ctx.actorId, "actor"),
  };
}

function firstRow(data: unknown): Record<string, unknown> {
  const row = Array.isArray(data) ? data[0] : data;
  if (!row || typeof row !== "object") throw new FinanceReversalError("unavailable", "Core returned no governed result");
  return row as Record<string, unknown>;
}

async function call(client: RpcClient, fn: (typeof FINANCE_TWO_STEP_REVERSAL_CORE_RPCS)[number], args: Record<string, unknown>) {
  const { data, error } = await client.rpc(fn, args);
  if (error) throw classifyFinanceReversalFailure(error);
  return firstRow(data);
}

export type FinanceReversalStep = { eventId: string; decision: string; replayed: boolean };

/** Treat structurally invalid server results as failures, never as successful financial operations. */
function financeStep(row: Record<string, unknown>, eventKey: string, replayKey: string, decisions: readonly string[]): FinanceReversalStep {
  const eventId = row[eventKey];
  const decision = row.decision;
  const replayed = row[replayKey];
  if (typeof eventId !== "string" || !eventId.trim() || typeof decision !== "string" ||
    !decisions.includes(decision) || typeof replayed !== "boolean") {
    throw new FinanceReversalError("unavailable", "Core returned an invalid Finance reversal result");
  }
  return { eventId, decision, replayed };
}

export async function requestFinanceReversalV1(
  input: { targetEventId: string; ctx: FinanceReversalContext },
  client: RpcClient = supabase as unknown as RpcClient,
): Promise<FinanceReversalStep> {
  const row = await call(client, "request_finance_reversal_v1", { p_event_id: required(input.targetEventId, "target event"), ...baseArgs(input.ctx) });
  return financeStep(row, "request_event_id", "already_requested", ["PENDING"]);
}

export async function decideFinanceReversalV1(
  input: { requestEventId: string; approve: boolean; ctx: FinanceReversalContext },
  client: RpcClient = supabase as unknown as RpcClient,
): Promise<FinanceReversalStep> {
  const row = await call(client, "decide_finance_reversal_v1", { p_request_event_id: required(input.requestEventId, "request event"), p_approve: input.approve, ...baseArgs(input.ctx) });
  return financeStep(row, "approval_event_id", "already_decided", ["APPROVED", "REJECTED"]);
}

export async function completeFinanceReversalV1(
  input: { requestEventId: string; ctx: FinanceReversalContext },
  client: RpcClient = supabase as unknown as RpcClient,
): Promise<FinanceReversalStep> {
  const row = await call(client, "complete_finance_reversal_v1", { p_request_event_id: required(input.requestEventId, "request event"), ...baseArgs(input.ctx) });
  return financeStep(row, "control_event_id", "already_reversed", ["REVERSED"]);
}

export type FinanceControlEventRow = { id: string; control_kind: string; decision: string; prior_event_id: string | null; actor_id?: string | null; approver_id?: string | null };
export type FinanceReversalStatus = "NONE" | "REQUESTED" | "APPROVED" | "REJECTED" | "COMPLETED";

/** Read-only visibility of where a target control event stands in the two-step flow (append-only event history). */
export function deriveFinanceReversalStatus(targetEventId: string, events: FinanceControlEventRow[]): { status: FinanceReversalStatus; requestEventId: string | null; awaitingSecondPerson: boolean } {
  if (events.some((e) => e.control_kind === "REVERSAL" && e.decision === "REVERSED" && e.prior_event_id === targetEventId)) {
    return { status: "COMPLETED", requestEventId: null, awaitingSecondPerson: false };
  }
  const requests = events.filter((e) => e.control_kind === "REVERSAL_REQUEST" && e.prior_event_id === targetEventId);
  const open = requests
    .map((request) => ({ request, approval: events.find((e) => e.control_kind === "REVERSAL_APPROVAL" && e.prior_event_id === request.id) }))
    .filter(({ approval }) => !approval || approval.decision === "APPROVED")
    .at(-1);
  if (!open) return { status: requests.length ? "REJECTED" : "NONE", requestEventId: null, awaitingSecondPerson: false };
  return open.approval
    ? { status: "APPROVED", requestEventId: open.request.id, awaitingSecondPerson: false }
    : { status: "REQUESTED", requestEventId: open.request.id, awaitingSecondPerson: true };
}
