import { supabase } from "@/integrations/supabase/client";
import { assertFinanceAuthority } from "@/lib/finance-authority/financeAuthorityGuard";
import {
  buildFinanceOperationsCorrelationId,
  buildFinanceOperationsDecisionIdentity,
  buildFinanceOperationsIdempotencyKey,
  decideFinanceOperationsClearance,
  getFinanceOperationsClearanceFacts,
  type FinanceOperationsClearanceFacts,
  type FinanceOperationsDecisionResult,
} from "@/lib/order-authority/financeClearanceAuthorityClient";
import {
  decideFinanceDispatchClearance,
  getFinanceExitFacts,
  type FinanceExitFacts,
} from "@/lib/order-authority/financeExitAuthorityClient";
import { placeFinanceHold } from "@/lib/order-authority/financeControlMutations";
import { resolvePaymentBinding } from "@/lib/order-authority/paymentAuthorityClient";

type RpcError = { message: string; code?: string; details?: string; hint?: string };
type RpcClient = {
  rpc<T = unknown>(fn: string, args?: Record<string, unknown>): Promise<{ data: T | null; error: RpcError | null }>;
};

const db = supabase as unknown as RpcClient;

export class FinanceHoldReleaseAuthorityError extends Error {
  readonly code?: string;
  readonly prerequisite?: string;

  constructor(message: string, options?: { code?: string; prerequisite?: string }) {
    super(message);
    this.name = "FinanceHoldReleaseAuthorityError";
    this.code = options?.code;
    this.prerequisite = options?.prerequisite;
  }
}

export const POINT80_REQUIRED_CORE_RPCS = [
  "get_finance_control_facts_v1",
  "place_finance_hold_v1",
  "release_finance_hold_v1",
  "request_finance_reversal_v1",
  "complete_finance_reversal_v1",
  "request_finance_second_approval_v1",
  "decide_finance_second_approval_v1",
] as const;

export type Point80RequiredCoreRpc = (typeof POINT80_REQUIRED_CORE_RPCS)[number];

/** Canonical PF-6D prerequisite — aligned with #525 census, not invented commercial_* names. */
export const POINT80_TYPED_CONTROL_CORE_PREREQUISITE =
  "Core prerequisite (oasis-supabase-core): deploy get_finance_control_facts_v1, place_finance_hold_v1, release_finance_hold_v1, request_finance_reversal_v1, complete_finance_reversal_v1, request_finance_second_approval_v1, and decide_finance_second_approval_v1 with has_step_up_auth(), actor binding, PI/commercial_version binding, idempotency keys, stale-version denial, and immutable audit events before Central may mutate typed finance hold/release/reversal/second-approval authority.";

/** @deprecated Use POINT80_TYPED_CONTROL_CORE_PREREQUISITE */
export const COMMERCIAL_HOLD_RELEASE_CORE_PREREQUISITE = POINT80_TYPED_CONTROL_CORE_PREREQUISITE;

export type FinanceControlLane = "operations" | "dispatch";
export type FinanceControlAction = "hold" | "release" | "reversal";

export type FinanceControlSurfaceKind =
  | "operations_clearance"
  | "dispatch_clearance"
  | "typed_finance_hold"
  | "typed_finance_release"
  | "typed_finance_reversal"
  | "typed_second_approval"
  | "payment_proof"
  | "wallet_credit"
  | "dispatch_completion_hold"
  | "dispatch_finalization_reversal"
  | "derived_ui_hold"
  | "legacy_restore"
  | "shadow_finance_review_evidence";

export type FinanceControlSurfaceRecord = {
  kind: FinanceControlSurfaceKind;
  action: string;
  coreRpc: string | null;
  actorRoles: string[];
  requiresAal2: boolean;
  requiresSecondApproval: boolean;
  bindsOrderPiCommercialVersion: boolean;
  idempotent: boolean;
  pointScope: "point80" | "point78" | "point79" | "point81" | "out_of_scope";
  shadowRisk: "none" | "ui_only" | "direct_table" | "legacy_rpc";
  notes: string;
};

export const FINANCE_CONTROL_SURFACE_CENSUS: FinanceControlSurfaceRecord[] = [
  {
    kind: "operations_clearance",
    action: "release|reversal",
    coreRpc: "decide_finance_operations_clearance_v1",
    actorRoles: ["FINANCE_HEAD", "ADMIN", "SUPER_ADMIN"],
    requiresAal2: true,
    requiresSecondApproval: false,
    bindsOrderPiCommercialVersion: true,
    idempotent: true,
    pointScope: "point80",
    shadowRisk: "none",
    notes: "PF-6C GRANTED=release, REVOKED=reversal; facts via get_finance_operations_clearance_facts_v1",
  },
  {
    kind: "dispatch_clearance",
    action: "release|reversal",
    coreRpc: "decide_finance_dispatch_clearance_v1",
    actorRoles: ["FINANCE_HEAD", "ADMIN", "SUPER_ADMIN"],
    requiresAal2: true,
    requiresSecondApproval: false,
    bindsOrderPiCommercialVersion: false,
    idempotent: true,
    pointScope: "point80",
    shadowRisk: "none",
    notes: "Binds final_invoice_id; facts via get_finance_exit_facts_v1",
  },
  {
    kind: "typed_finance_hold",
    action: "place_hold",
    coreRpc: "place_finance_hold_v1",
    actorRoles: ["FINANCE_HEAD", "ADMIN", "SUPER_ADMIN"],
    requiresAal2: true,
    requiresSecondApproval: false,
    bindsOrderPiCommercialVersion: true,
    idempotent: true,
    pointScope: "point80",
    shadowRisk: "direct_table",
    notes: "PF-6D typed hold — blocked until Core deploys POINT80_REQUIRED_CORE_RPCS",
  },
  {
    kind: "typed_finance_release",
    action: "release_hold",
    coreRpc: "release_finance_hold_v1",
    actorRoles: ["FINANCE_HEAD", "ADMIN", "SUPER_ADMIN"],
    requiresAal2: true,
    requiresSecondApproval: false,
    bindsOrderPiCommercialVersion: true,
    idempotent: true,
    pointScope: "point80",
    shadowRisk: "direct_table",
    notes: "Requires immutable hold_event_id from get_finance_control_facts_v1",
  },
  {
    kind: "typed_finance_reversal",
    action: "request|complete",
    coreRpc: "request_finance_reversal_v1|complete_finance_reversal_v1",
    actorRoles: ["FINANCE_HEAD", "ADMIN", "SUPER_ADMIN"],
    requiresAal2: true,
    requiresSecondApproval: true,
    bindsOrderPiCommercialVersion: true,
    idempotent: true,
    pointScope: "point80",
    shadowRisk: "direct_table",
    notes: "Two-step reversal with immutable original_event_id; complete requires distinct actor",
  },
  {
    kind: "typed_second_approval",
    action: "request|decide",
    coreRpc: "request_finance_second_approval_v1|decide_finance_second_approval_v1",
    actorRoles: ["FINANCE_HEAD", "FINANCE_MANAGER", "ADMIN", "SUPER_ADMIN"],
    requiresAal2: true,
    requiresSecondApproval: true,
    bindsOrderPiCommercialVersion: true,
    idempotent: true,
    pointScope: "point80",
    shadowRisk: "direct_table",
    notes: "High-value/exceptional release lane — deciding actor must differ from requester",
  },
  {
    kind: "shadow_finance_review_evidence",
    action: "direct_table_write",
    coreRpc: null,
    actorRoles: ["FINANCE_HEAD", "ADMIN", "SUPER_ADMIN"],
    requiresAal2: true,
    requiresSecondApproval: false,
    bindsOrderPiCommercialVersion: true,
    idempotent: false,
    pointScope: "point80",
    shadowRisk: "direct_table",
    notes: "Blocked — finance_review_evidence direct writes are not Core authority",
  },
  {
    kind: "payment_proof",
    action: "record|verify|reject",
    coreRpc: "record_order_payment_proof_v1|verify_order_payment_v1|reject_order_payment_v1",
    actorRoles: ["FINANCE_HEAD", "FINANCE_EXEC", "ADMIN", "SUPER_ADMIN"],
    requiresAal2: true,
    requiresSecondApproval: false,
    bindsOrderPiCommercialVersion: true,
    idempotent: true,
    pointScope: "point78",
    shadowRisk: "none",
    notes: "Point 78 payment evidence — out of Point 80 execution lane",
  },
  {
    kind: "wallet_credit",
    action: "wallet_entry|credit_request|credit_decision",
    coreRpc: "record_wallet_entry_v1|request_credit_authority_v1|decide_credit_request_v1",
    actorRoles: ["FINANCE_HEAD", "ADMIN", "SUPER_ADMIN"],
    requiresAal2: true,
    requiresSecondApproval: true,
    bindsOrderPiCommercialVersion: true,
    idempotent: true,
    pointScope: "point79",
    shadowRisk: "none",
    notes: "Point 79 wallet/credit — out of Point 80 execution lane",
  },
  {
    kind: "dispatch_completion_hold",
    action: "place_completion_hold|release_completion_hold",
    coreRpc: null,
    actorRoles: ["DISPATCH_HEAD", "DISPATCH_MANAGER", "ADMIN"],
    requiresAal2: false,
    requiresSecondApproval: false,
    bindsOrderPiCommercialVersion: false,
    idempotent: false,
    pointScope: "out_of_scope",
    shadowRisk: "ui_only",
    notes: "Dispatch completion evidence only — not finance hold authority",
  },
  {
    kind: "dispatch_finalization_reversal",
    action: "request_reversal|complete_reversal",
    coreRpc: null,
    actorRoles: ["DISPATCH_HEAD", "ADMIN"],
    requiresAal2: false,
    requiresSecondApproval: false,
    bindsOrderPiCommercialVersion: false,
    idempotent: false,
    pointScope: "out_of_scope",
    shadowRisk: "ui_only",
    notes: "Compensating lineage only — separate dispatch finalization lane",
  },
  {
    kind: "derived_ui_hold",
    action: "derive_finance_hold",
    coreRpc: null,
    actorRoles: [],
    requiresAal2: false,
    requiresSecondApproval: false,
    bindsOrderPiCommercialVersion: false,
    idempotent: false,
    pointScope: "point80",
    shadowRisk: "ui_only",
    notes: "Read-only derivation in financeReleaseState.ts — must not mutate backend",
  },
  {
    kind: "legacy_restore",
    action: "restore_order_financials",
    coreRpc: "restore_order_financials",
    actorRoles: ["FINANCE_HEAD", "ADMIN"],
    requiresAal2: false,
    requiresSecondApproval: false,
    bindsOrderPiCommercialVersion: false,
    idempotent: false,
    pointScope: "out_of_scope",
    shadowRisk: "legacy_rpc",
    notes: "Legacy repair RPC — not hold/release/reversal canonical authority",
  },
];

const OPERATIONS_FINANCE_ROLES = new Set(["FINANCE_HEAD", "ADMIN", "SUPER_ADMIN"]);
const HIGH_VALUE_SECOND_APPROVAL_THRESHOLD = 250_000;

function required(value: string, field: string): string {
  const normalized = value.trim();
  if (!normalized) throw new FinanceHoldReleaseAuthorityError(`${field} is required`, { code: "validation_failed" });
  return normalized;
}

function mapClearanceDecision(action: Exclude<FinanceControlAction, "hold">): "GRANTED" | "REVOKED" {
  return action === "release" ? "GRANTED" : "REVOKED";
}

function authorityActionFor(action: FinanceControlAction): string {
  if (action === "hold") return "finance:place_hold";
  if (action === "release") return "finance:commercial_release";
  return "finance:reject_release";
}

export type FinanceControlWriteInput = {
  lane: FinanceControlLane;
  action: FinanceControlAction;
  orderId: string;
  reason: string;
  evidenceReference: string;
  actorId: string;
  actorRole: string;
  aal2Verified: boolean;
  commercialValue?: number | null;
  priorDecisionActorId?: string | null;
  secondApproverActorId?: string | null;
  requestActorId?: string | null;
  holdType?: string | null;
  expectedSourceVersion?: number | null;
  piId?: string | null;
  commercialVersionId?: string | null;
  finalInvoiceId?: string | null;
  correlationId?: string;
  idempotencyKey?: string;
  typedControlAvailable?: boolean;
};

export type FinanceControlWriteResult = {
  lane: FinanceControlLane;
  action: FinanceControlAction;
  decision: "GRANTED" | "DENIED" | "REVOKED" | "HELD";
  eventId: string;
  alreadyDecided: boolean;
  facts: FinanceOperationsClearanceFacts | FinanceExitFacts | null;
};

export function requiresSecondApproval(commercialValue: number | null | undefined): boolean {
  return typeof commercialValue === "number" && Number.isFinite(commercialValue) && commercialValue >= HIGH_VALUE_SECOND_APPROVAL_THRESHOLD;
}

export function assertDualControl(requestActorId: string | null | undefined, decidingActorId: string): void {
  const requester = requestActorId?.trim();
  const decider = decidingActorId.trim();
  if (requester && requester === decider) {
    throw new FinanceHoldReleaseAuthorityError(
      "Second approval / reversal completion requires a different actor from the requesting actor.",
      { code: "self_approval_denied" },
    );
  }
}

export function assertSourceVersion(expected: number | null | undefined, actual: number | null | undefined): void {
  if (expected == null || actual == null) return;
  if (expected !== actual) {
    throw new FinanceHoldReleaseAuthorityError(
      `Stale finance control source version: expected ${expected}, Core returned ${actual}.`,
      { code: "stale_version" },
    );
  }
}

export function formatFinanceControlPrerequisite(missing: Point80RequiredCoreRpc[]): string {
  if (missing.length === 0) return POINT80_TYPED_CONTROL_CORE_PREREQUISITE;
  return `Core prerequisite: deploy and protect ${missing.join(", ")} in oasis-supabase-core (Point 80 PF-6D finance control authority). Central must not create shadow hold/release/reversal truth.`;
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

export async function probeFinanceControlCoreRpc(rpc: Point80RequiredCoreRpc): Promise<boolean> {
  const { error } = await db.rpc(rpc, {});
  if (!error) return true;
  return !isMissingRpcError(error);
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

export function assertFinanceControlWriteGuards(input: FinanceControlWriteInput): void {
  const role = required(input.actorRole, "actor role").toUpperCase();
  const actorId = required(input.actorId, "actor id");
  required(input.reason, "reason");
  required(input.evidenceReference, "evidence reference");

  if (!input.aal2Verified) {
    throw new FinanceHoldReleaseAuthorityError("AAL2 step-up authentication is required for finance hold/release/reversal writes", {
      code: "aal2_required",
    });
  }

  const auth = assertFinanceAuthority(authorityActionFor(input.action), {
    actorRole: role,
    actorUserId: actorId,
    overrideReason: input.action === "reversal" ? input.reason : null,
  });
  if (!auth.allowed) {
    throw new FinanceHoldReleaseAuthorityError(auth.reason, { code: "authority_denied" });
  }

  if (input.action !== "hold" && input.lane === "operations" && !OPERATIONS_FINANCE_ROLES.has(role) && role !== "SUPER_ADMIN") {
    throw new FinanceHoldReleaseAuthorityError(`Role ${role} cannot decide Operations Clearance`, { code: "authority_denied" });
  }

  if (input.action === "reversal" && input.requestActorId) {
    assertDualControl(input.requestActorId, actorId);
  }

  if (requiresSecondApproval(input.commercialValue ?? null)) {
    const second = input.secondApproverActorId?.trim() || null;
    const prior = input.priorDecisionActorId?.trim() || null;
    if (!second) {
      throw new FinanceHoldReleaseAuthorityError("High-value finance control requires a distinct second approver", {
        code: "second_approval_required",
      });
    }
    if (second === actorId) {
      throw new FinanceHoldReleaseAuthorityError("Self-approval is forbidden when dual control is required", {
        code: "self_approval_denied",
      });
    }
    if (prior && prior === second) {
      throw new FinanceHoldReleaseAuthorityError("Second approver must differ from the prior decision actor", {
        code: "stale_dual_control",
      });
    }
  }
}

export function assertCommercialHoldReleaseCoreAvailable(): never {
  throw new FinanceHoldReleaseAuthorityError(
    "Typed finance hold/release/reversal/second-approval is blocked until Core deploys PF-6D finance control RPCs",
    { code: "core_prerequisite_missing", prerequisite: POINT80_TYPED_CONTROL_CORE_PREREQUISITE },
  );
}

async function buildOperationsIdentity(
  facts: FinanceOperationsClearanceFacts,
  decision: "GRANTED" | "DENIED" | "REVOKED",
  reason: string,
  evidenceReference: string,
  secondApproverActorId?: string | null,
): Promise<{ correlationId: string; idempotencyKey: string }> {
  const identity = buildFinanceOperationsDecisionIdentity(facts, decision, reason, evidenceReference);
  const suffix = secondApproverActorId ? `:${secondApproverActorId}` : "";
  return {
    correlationId: await buildFinanceOperationsCorrelationId(`${identity}${suffix}`),
    idempotencyKey: await buildFinanceOperationsIdempotencyKey(`${identity}${suffix}`),
  };
}

async function buildTypedControlIdentity(scope: string, parts: unknown[]): Promise<{ correlationId: string; idempotencyKey: string }> {
  const identity = JSON.stringify(parts);
  const digest = async (label: string) => {
    const subtle = globalThis.crypto?.subtle;
    if (!subtle) throw new FinanceHoldReleaseAuthorityError("Web Crypto SHA-256 is unavailable", { code: "unavailable" });
    const hash = await subtle.digest("SHA-256", new TextEncoder().encode(`${label}:${identity}`));
    return Array.from(new Uint8Array(hash), (byte) => byte.toString(16).padStart(2, "0")).join("");
  };
  return {
    correlationId: `central:pf6d:${scope}:${await digest("correlation")}`,
    idempotencyKey: `central:pf6d:${scope}:${await digest("idempotency")}`,
  };
}

async function executeTypedHold(input: FinanceControlWriteInput): Promise<FinanceControlWriteResult> {
  if (input.typedControlAvailable !== true) {
    assertCommercialHoldReleaseCoreAvailable();
  }

  const orderId = required(input.orderId, "order id");
  const binding = input.piId && input.commercialVersionId
    ? { orderId, piId: input.piId, commercialVersionId: input.commercialVersionId }
    : await resolvePaymentBinding(orderId);
  const holdType = required(input.holdType ?? "compliance_review_pending", "hold type");
  const ids = input.correlationId && input.idempotencyKey
    ? { correlationId: input.correlationId, idempotencyKey: input.idempotencyKey }
    : await buildTypedControlIdentity("hold", [binding.orderId, binding.piId, binding.commercialVersionId, holdType, input.reason]);

  const result = await placeFinanceHold({
    binding,
    holdType,
    ctx: {
      actorId: input.actorId,
      actorRole: input.actorRole,
      reason: input.reason,
      evidenceReference: input.evidenceReference,
      sourceChannel: "CENTRAL",
      sourceReference: `point80:typed-hold:${orderId}`,
      correlationId: ids.correlationId,
      idempotencyKey: ids.idempotencyKey,
      expectedSourceVersion: input.expectedSourceVersion ?? null,
    },
  });

  return {
    lane: input.lane,
    action: "hold",
    decision: "HELD",
    eventId: result.eventId,
    alreadyDecided: result.alreadyApplied,
    facts: null,
  };
}

async function executeClearanceWrite(input: FinanceControlWriteInput): Promise<FinanceControlWriteResult> {
  const decision = mapClearanceDecision(input.action as Exclude<FinanceControlAction, "hold">);
  const orderId = required(input.orderId, "order id");

  if (input.lane === "operations") {
    const binding = input.piId && input.commercialVersionId
      ? { piId: input.piId, commercialVersionId: input.commercialVersionId }
      : await resolvePaymentBinding(orderId);
    const facts = await getFinanceOperationsClearanceFacts(orderId, binding.piId, binding.commercialVersionId);

    if (input.action === "release" && !facts.eligibleForOperationsClearance) {
      throw new FinanceHoldReleaseAuthorityError(
        `Operations release blocked: covered ₹${facts.coveredAmount.toLocaleString("en-IN")} of required ₹${facts.requiredAdvance.toLocaleString("en-IN")}`,
        { code: "validation_failed" },
      );
    }

    if (input.action === "reversal" && facts.latestClearanceDecision !== "GRANTED") {
      throw new FinanceHoldReleaseAuthorityError("Operations reversal requires an existing GRANTED clearance decision", {
        code: "stale_state",
      });
    }

    const ids = input.correlationId && input.idempotencyKey
      ? { correlationId: input.correlationId, idempotencyKey: input.idempotencyKey }
      : await buildOperationsIdentity(
          facts,
          decision,
          input.reason,
          input.evidenceReference,
          input.secondApproverActorId,
        );

    const result: FinanceOperationsDecisionResult = await decideFinanceOperationsClearance({
      orderId,
      piId: facts.piId,
      commercialVersionId: facts.commercialVersionId,
      decision,
      reason: input.reason,
      evidenceReference: input.evidenceReference,
      sourceChannel: "CENTRAL",
      sourceReference: `point80:${input.lane}:${input.action}:${orderId}`,
      correlationId: ids.correlationId,
      idempotencyKey: ids.idempotencyKey,
      actorId: input.actorId,
    });

    return {
      lane: input.lane,
      action: input.action,
      decision: result.decision,
      eventId: result.clearanceEventId,
      alreadyDecided: result.alreadyDecided,
      facts,
    };
  }

  const finalInvoiceId = required(input.finalInvoiceId ?? "", "final invoice id");
  const exitFacts = await getFinanceExitFacts(orderId);
  if (exitFacts.finalInvoiceId && exitFacts.finalInvoiceId !== finalInvoiceId) {
    throw new FinanceHoldReleaseAuthorityError("Dispatch control final_invoice_id mismatch", { code: "binding_mismatch" });
  }

  if (input.action === "release" && exitFacts.dispatchCleared) {
    return {
      lane: input.lane,
      action: input.action,
      decision: "GRANTED",
      eventId: exitFacts.dispatchClearanceEventId ?? "already-released",
      alreadyDecided: true,
      facts: exitFacts,
    };
  }

  if (input.action === "reversal" && exitFacts.dispatchClearanceDecision !== "GRANTED") {
    throw new FinanceHoldReleaseAuthorityError("Dispatch reversal requires an existing GRANTED dispatch clearance", {
      code: "stale_state",
    });
  }

  const dispatchResult = await decideFinanceDispatchClearance({
    finalInvoiceId,
    decision,
    reason: input.reason,
    evidenceReference: input.evidenceReference,
    actorId: input.actorId,
  });

  return {
    lane: input.lane,
    action: input.action,
    decision,
    eventId: String((dispatchResult as { clearance_event_id?: string }).clearance_event_id ?? finalInvoiceId),
    alreadyDecided: Boolean((dispatchResult as { already_decided?: boolean }).already_decided),
    facts: exitFacts,
  };
}

export async function executeFinanceControlWrite(input: FinanceControlWriteInput): Promise<FinanceControlWriteResult> {
  assertFinanceControlWriteGuards(input);
  if (input.action === "hold") {
    return executeTypedHold(input);
  }
  return executeClearanceWrite(input);
}

export function listPoint80ShadowSurfaces(): FinanceControlSurfaceRecord[] {
  return FINANCE_CONTROL_SURFACE_CENSUS.filter((row) => row.shadowRisk !== "none" && row.pointScope === "point80");
}

export function listPoint80CoreSurfaces(): FinanceControlSurfaceRecord[] {
  return FINANCE_CONTROL_SURFACE_CENSUS.filter((row) => row.coreRpc && row.pointScope === "point80");
}

export function listPoint80ClearanceSurfaces(): FinanceControlSurfaceRecord[] {
  return FINANCE_CONTROL_SURFACE_CENSUS.filter(
    (row) => row.kind === "operations_clearance" || row.kind === "dispatch_clearance",
  );
}

export function listPoint80TypedControlSurfaces(): FinanceControlSurfaceRecord[] {
  return FINANCE_CONTROL_SURFACE_CENSUS.filter((row) =>
    ["typed_finance_hold", "typed_finance_release", "typed_finance_reversal", "typed_second_approval"].includes(row.kind),
  );
}
