import { supabase } from "@/integrations/supabase/client";

type RpcClient = {
  rpc: (fn: string, args?: Record<string, unknown>) => Promise<{ data: unknown; error: { message: string } | null }>;
};

const authorityRpc = (supabase as unknown as RpcClient).rpc;

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

export async function releaseOrderToManufacturing(
  orderId: string,
  paymentStatus?: string | null,
  advancePaid?: number | null,
  salesOrderValue?: number | null,
): Promise<AuthorityRpcResult> {
  const { data, error } = await authorityRpc("release_order_to_manufacturing_v1", {
    p_order_id: orderId,
    p_payment_status: paymentStatus ?? undefined,
    p_advance_paid: advancePaid ?? undefined,
    p_sales_order_value: salesOrderValue ?? undefined,
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
  paymentStatus?: string | null,
): Promise<AuthorityRpcResult> {
  const { data, error } = await authorityRpc("release_order_to_in_production_v1", {
    p_order_id: orderId,
    p_payment_status: paymentStatus ?? undefined,
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
