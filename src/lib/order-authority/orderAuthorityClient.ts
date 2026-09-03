import { supabase } from "@/integrations/supabase/client";
import { resolvePaymentBinding } from "@/lib/order-authority/paymentAuthorityClient";
import {
  buildFinanceOperationsCorrelationId,
  buildFinanceOperationsDecisionIdentity,
  buildFinanceOperationsIdempotencyKey,
  decideFinanceOperationsClearance,
  getFinanceOperationsClearanceFacts,
} from "@/lib/order-authority/financeClearanceAuthorityClient";

type RpcResult = { data: unknown; error: { message: string } | null };

type RpcClient = {
  rpc: (fn: string, args?: Record<string, unknown>) => Promise<RpcResult>;
};

/** Preserve SupabaseClient receiver — detached `.rpc` breaks `this.rest` binding. */
function authorityRpc(fn: string, args?: Record<string, unknown>): Promise<RpcResult> {
  const rpc = (supabase as unknown as RpcClient).rpc;
  return rpc.call(supabase, fn, args);
}

export type AuthorityBlocker = {
  code?: string;
  message?: string;
  scope?: string;
};

export type AuthorityRpcResult = {
  ok: boolean;
  order_id?: string;
  previous_status?: string;
  new_status?: string;
  already_applied?: boolean;
  blockers?: AuthorityBlocker[];
};

function blockersFromResult(data: unknown): AuthorityBlocker[] {
  if (!data || typeof data !== "object") return [];
  const blockers = (data as { blockers?: AuthorityBlocker[] }).blockers;
  return Array.isArray(blockers) ? blockers : [];
}

function formatBlockers(blockers: AuthorityBlocker[]): string {
  return blockers.map((b) => b.message ?? b.code ?? "Blocked").join("; ");
}

async function ensureFinanceOperationsClearance(orderId: string): Promise<void> {
  const { data: authData, error: authError } = await supabase.auth.getUser();
  if (authError) throw new Error(authError.message);
  const actorId = authData.user?.id;
  if (!actorId) throw new Error("Authenticated Finance actor is required for Operations Clearance");

  const binding = await resolvePaymentBinding(orderId);
  const facts = await getFinanceOperationsClearanceFacts(
    orderId,
    binding.piId,
    binding.commercialVersionId,
  );

  if (facts.latestClearanceDecision === "GRANTED") return;
  if (!facts.eligibleForOperationsClearance) {
    throw new Error(
      `Finance Operations Clearance blocked: covered ₹${facts.coveredAmount.toLocaleString("en-IN")} of required ₹${facts.requiredAdvance.toLocaleString("en-IN")}`,
    );
  }

  const reason = "Finance review approved Operations Clearance";
  const evidenceReference = `core-finance-facts:${facts.piId}:${facts.commercialVersionId}`;
  const identity = buildFinanceOperationsDecisionIdentity(
    facts,
    "GRANTED",
    reason,
    evidenceReference,
  );

  await decideFinanceOperationsClearance({
    orderId,
    piId: facts.piId,
    commercialVersionId: facts.commercialVersionId,
    decision: "GRANTED",
    reason,
    evidenceReference,
    sourceChannel: "CENTRAL",
    sourceReference: `operations-release:${orderId}`,
    correlationId: await buildFinanceOperationsCorrelationId(identity),
    idempotencyKey: await buildFinanceOperationsIdempotencyKey(identity),
    actorId,
  });
}

export async function releaseOrderToManufacturing(
  orderId: string,
  _paymentStatus?: string | null,
  _advancePaid?: number | null,
  _salesOrderValue?: number | null,
): Promise<AuthorityRpcResult> {
  await ensureFinanceOperationsClearance(orderId);
  const { data, error } = await authorityRpc("release_order_to_manufacturing_v1", {
    p_order_id: orderId,
  });
  if (error) throw new Error(error.message);
  const result = data as AuthorityRpcResult;
  if (!result?.ok) {
    throw new Error(formatBlockers(blockersFromResult(result)) || "Manufacturing release denied");
  }
  return result;
}

export async function releaseOrderToInProduction(
  orderId: string,
  _paymentStatus?: string | null,
): Promise<AuthorityRpcResult> {
  await ensureFinanceOperationsClearance(orderId);
  const { data, error } = await authorityRpc("release_order_to_in_production_v1", {
    p_order_id: orderId,
  });
  if (error) throw new Error(error.message);
  const result = data as AuthorityRpcResult;
  if (!result?.ok) {
    throw new Error(formatBlockers(blockersFromResult(result)) || "Production release denied");
  }
  return result;
}

export async function updateOrderFinanceVerification(
  orderId: string,
  paymentStatus: string,
): Promise<AuthorityRpcResult> {
  const { data, error } = await authorityRpc("update_order_finance_verification_v1", {
    p_order_id: orderId,
    p_payment_status: paymentStatus,
  });
  if (error) throw new Error(error.message);
  const result = data as AuthorityRpcResult;
  if (!result?.ok) {
    throw new Error(formatBlockers(blockersFromResult(result)) || "Finance verification denied");
  }
  return result;
}

export async function clearOrderForDispatch(orderId: string): Promise<AuthorityRpcResult> {
  const { data, error } = await authorityRpc("clear_order_for_dispatch_v1", {
    p_order_id: orderId,
  });
  if (error) throw new Error(error.message);
  const result = data as AuthorityRpcResult;
  if (!result?.ok) {
    throw new Error(formatBlockers(blockersFromResult(result)) || "Dispatch clearance denied");
  }
  return result;
}

export async function releaseOrderToDispatched(
  orderId: string,
  options?: {
    trackingNumber?: string | null;
    courierName?: string | null;
    finalizeReason?: string | null;
    correlationId?: string | null;
  },
): Promise<AuthorityRpcResult> {
  const { data, error } = await authorityRpc("release_order_to_dispatched_v1", {
    p_order_id: orderId,
    p_tracking_number: options?.trackingNumber ?? null,
    p_courier_name: options?.courierName ?? null,
    p_finalize_reason: options?.finalizeReason ?? null,
    p_correlation_id: options?.correlationId ?? null,
  });
  if (error) throw new Error(error.message);
  const result = data as AuthorityRpcResult;
  if (!result?.ok) {
    throw new Error(formatBlockers(blockersFromResult(result)) || "Dispatch finalization denied");
  }
  return result;
}

export async function releaseOrderToPackedReady(orderId: string): Promise<AuthorityRpcResult> {
  const { data, error } = await authorityRpc("release_order_to_packed_ready_v1", {
    p_order_id: orderId,
  });
  if (error) throw new Error(error.message);
  const result = data as AuthorityRpcResult;
  if (!result?.ok) {
    throw new Error(formatBlockers(blockersFromResult(result)) || "Packed ready transition denied");
  }
  return result;
}

export async function rejectOrderFinanceReview(
  orderId: string,
  rejectionReason: string,
): Promise<AuthorityRpcResult> {
  const { data, error } = await authorityRpc("reject_order_finance_review_v1", {
    p_order_id: orderId,
    p_rejection_reason: rejectionReason,
  });
  if (error) throw new Error(error.message);
  const result = data as AuthorityRpcResult;
  if (!result?.ok) {
    throw new Error(formatBlockers(blockersFromResult(result)) || "Finance rejection denied");
  }
  return result;
}

export async function confirmPrepaidOrderAwaitingAdvance(orderId: string): Promise<AuthorityRpcResult> {
  const { data, error } = await authorityRpc("confirm_prepaid_order_awaiting_advance_v1", {
    p_order_id: orderId,
  });
  if (error) throw new Error(error.message);
  const result = data as AuthorityRpcResult;
  if (!result?.ok) {
    throw new Error(formatBlockers(blockersFromResult(result)) || "Order confirmation denied");
  }
  return result;
}

export async function recordOrderFullyPaid(orderId: string): Promise<AuthorityRpcResult> {
  const { data, error } = await authorityRpc("record_order_fully_paid_v1", {
    p_order_id: orderId,
  });
  if (error) throw new Error(error.message);
  const result = data as AuthorityRpcResult;
  if (!result?.ok) {
    throw new Error(formatBlockers(blockersFromResult(result)) || "Full payment recording denied");
  }
  return result;
}

export type GateReleaseResult = {
  ok: boolean;
  carton_id?: string;
  order_id?: string;
  carton_status?: string;
  already_released?: boolean;
  blockers?: AuthorityBlocker[];
};

export async function releaseCartonAtDispatchGate(
  cartonId: string,
  scanEvidenceId: string,
): Promise<GateReleaseResult> {
  const { data, error } = await authorityRpc("release_carton_at_dispatch_gate_v1", {
    p_carton_id: cartonId,
    p_scan_evidence_id: scanEvidenceId,
  });
  if (error) throw new Error(error.message);
  const result = data as GateReleaseResult;
  if (!result?.ok) {
    throw new Error(formatBlockers(blockersFromResult(result)) || "Gate release denied");
  }
  return result;
}

export function formatAuthorityBlockers(blockers: AuthorityBlocker[]): string {
  return formatBlockers(blockers);
}
