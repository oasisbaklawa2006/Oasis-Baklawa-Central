import type { SupabaseClient } from "@supabase/supabase-js";
import type { Point100ProbeOutcome } from "../../src/lib/point100/capabilityStatus";
import { POINT100_LIFECYCLE_STAGES } from "../../src/lib/point100/lifecycleStages";
import { buildProbeOutcome, probeFixtureKeys, resolvedRpcForStage } from "../../src/lib/point100/probeRunner";
import {
  POINT100_CORE_PRODUCTION_VERIFIED_SHA,
  POINT100_DISPATCH_FINALIZE_RPC,
  POINT100_PRODUCTION_MIGRATION_GATE,
  formatUpstreamBlocker,
  isRpcOnCertifiedCorePin,
  productionGateBlockers,
} from "../../src/lib/point100/upstreamDependencies";
import { CENTRAL_ADMIN_MODULE_AUTHORITY_MATRIX } from "../../src/lib/appverse/centralAdminModuleAuthorityMatrix";
import { macro556DispatchRoutesPresent } from "../../src/lib/point100/dispatchRouteCensus";
import { probeRpcExists } from "./support";

const CENTRAL_ROUTE_BINDINGS = new Set(
  CENTRAL_ADMIN_MODULE_AUTHORITY_MATRIX.map((entry) => entry.route),
);

const CENTRAL_CLIENT_BINDINGS = new Set([
  "customerAppClient",
  "paymentAuthorityClient",
  "financeClearanceAuthorityClient",
  "financeExitAuthorityClient",
  "gateExitAuthorityClient",
  "orderAuthorityClient",
  "rgsGovernedRpc",
  "orderTraceFeed",
  "FinanceGovernanceBoard",
  "DispatchManagement",
  "DispatchReadinessBoard",
  "DispatchCompletionBoard",
  "DispatchFinalizationBoard",
  "GoldenChainOperatorWizard",
  "OrderManagement",
  "ReadyGoodsStore",
  "AssemblyManagement",
  "productionJobsDatabase",
]);

/** Explicit dotted member bindings exercised by the Point100 lifecycle. */
const CENTRAL_DOTTED_BINDINGS = new Set([
  "customerAppClient.submitOrder",
  "customerAppClient.complaint_window_status",
]);

/**
 * Canonical PostgREST parameter-name probes for the production-certified Core
 * functions used by Point100. Values are deliberately inert/null where possible:
 * the disposable backend only needs PostgREST to resolve the signature; an auth
 * or business-validation error then proves the RPC exists without requiring a
 * successful mutation.
 */
const POINT100_RPC_PROBE_ARGS: Record<string, Record<string, unknown>> = {
  add_customer_order_draft_line_v1: { p_product_id: null, p_quantity: null },
  clear_customer_order_draft_v1: {},
  submit_customer_order_v1: { p_idempotency_key: null, p_requested_dispatch_date: null },
  record_order_payment_proof_v1: {
    p_order_id: null, p_pi_id: null, p_commercial_version_id: null, p_payment_type: null,
    p_submitted_amount: null, p_currency: null, p_payment_mode: null, p_external_reference: null,
    p_payer_reference: null, p_proof_evidence_reference: null, p_source_channel: null,
    p_source_reference: null, p_correlation_id: null, p_idempotency_key: null, p_actor_id: null,
  },
  verify_order_payment_v1: {
    p_payment_id: null, p_verified_amount: null, p_verified_reference: null,
    p_verification_evidence_reference: null, p_reason: null, p_correlation_id: null,
    p_idempotency_key: null, p_actor_id: null,
  },
  get_finance_operations_clearance_facts_v1: {
    p_order_id: null, p_pi_id: null, p_commercial_version_id: null,
  },
  release_order_to_in_production_v1: { p_order_id: null, p_payment_status: null },
  decide_finance_operations_clearance_v1: {
    p_order_id: null, p_pi_id: null, p_commercial_version_id: null, p_decision: null,
    p_reason: null, p_evidence_reference: null, p_source_channel: null, p_source_reference: null,
    p_correlation_id: null, p_idempotency_key: null, p_actor_id: null,
  },
  reserve_rgs_stock: {
    p_reservation_number: null, p_order_id: null, p_product_id: null, p_sku: null,
    p_requested_qty: null, p_source_department: null, p_correlation_id: null, p_priority: null,
    p_location_code: null, p_queue_item_id: null, p_customer_id: null,
    p_demand_source_type: null, p_demand_reference: null,
  },
  allocate_b2b_inventory_putaway: { p_receipt_id: null, p_allocations: null, p_correlation_id: null },
  record_inventory_lot_exception: {
    p_lot_position_id: null, p_action: null, p_quantity: null, p_reason: null, p_correlation_id: null,
  },
  accept_production_job: { p_job_id: null, p_batch_number: null, p_correlation_id: null },
  record_production_output: {
    p_job_id: null, p_produced_qty: null, p_wasted_qty: null, p_batch_number: null,
    p_correlation_id: null, p_notes: null, p_execution_metadata: null,
  },
  create_b2b_dispatch_consignment: {
    p_order_id: null, p_dispatch_mode: null, p_lines: null, p_correlation_id: null,
  },
  open_b2b_dispatch_carton: { p_consignment_id: null, p_carton_code: null },
  create_b2b_dispatch_packing_list: { p_consignment_id: null, p_correlation_id: null },
  submit_b2b_dispatch_packing_list_to_finance: {
    p_consignment_id: null, p_version_id: null, p_correlation_id: null,
  },
  issue_final_invoice_v1: {
    p_order_id: null, p_pi_id: null, p_commercial_version_id: null,
    p_finance_dpl_receipt_id: null, p_invoice_number: null, p_invoice_date: null,
    p_document_reference: null, p_reason: null, p_correlation_id: null,
    p_idempotency_key: null, p_actor_id: null,
  },
  get_finance_exit_facts_v1: { p_order_id: null },
  decide_finance_dispatch_clearance_v1: {
    p_final_invoice_id: null, p_decision: null, p_reason: null, p_evidence_reference: null,
    p_correlation_id: null, p_idempotency_key: null, p_actor_id: null,
  },
  receive_submitted_b2b_dispatch_dpls_v1: {
    p_order_id: null, p_evidence_reference: null, p_correlation_id: null,
    p_idempotency_key: null, p_actor_id: null,
  },
  record_dispatch_proof_packet_v1: {
    p_order_id: null, p_transport_snapshot: null, p_evidence_references: null,
    p_dispatched_at: null, p_correlation_id: null, p_idempotency_key: null, p_actor_id: null,
  },
  release_order_to_dispatched_v1: {
    p_order_id: null, p_tracking_number: null, p_courier_name: null,
    p_finalize_reason: null, p_correlation_id: null,
  },
  release_b2b_dispatch_carton_at_gate_v1: { p_carton_id: null, p_scan_evidence_id: null },
  trace_verify_handover_evidence_v1: {
    p_evidence: null, p_prior_hash: null, p_expected_action: null, p_enforce_consumption: null,
  },
  trace_sign_handover_evidence_v1: {
    p_stage: null, p_entity_type: null, p_entity_id: null, p_reference_no: null,
    p_metadata: null, p_actor_id: null, p_prior_hash: null,
  },
  trace_allocate_identity_v1: { p_kind: null },
};

export function point100RpcProbeArgs(rpcName: string): Record<string, unknown> {
  return POINT100_RPC_PROBE_ARGS[rpcName] ?? {};
}

function centralBindingPresent(binding: string): boolean {
  if (binding.startsWith("/")) {
    if (CENTRAL_ROUTE_BINDINGS.has(binding)) return true;
    // Wildcard census entries such as /buyer/* cover nested buyer routes.
    return CENTRAL_ROUTE_BINDINGS.has(`${binding.split("/").slice(0, 2).join("/")}/*`);
  }
  if (binding.includes(".")) return CENTRAL_DOTTED_BINDINGS.has(binding);
  return CENTRAL_CLIENT_BINDINGS.has(binding);
}

function stageCentralBindingsPresent(stage: typeof POINT100_LIFECYCLE_STAGES[number]): boolean {
  return stage.centralBindings.every((binding) => centralBindingPresent(binding));
}

function isPostgrestFunctionResolutionError(error: unknown): boolean {
  if (!error || typeof error !== "object") return false;
  const code = String((error as { code?: unknown }).code ?? "");
  const message = String((error as { message?: unknown }).message ?? "").toLowerCase();
  return code === "PGRST202" || message.includes("could not find the function");
}

export async function certifiedDispatchFinalizeProbe(): Promise<{
  ready: boolean;
  note: string;
  upstreamNotes: string[];
}> {
  const dispatchedRpc = await probeRpcExists(POINT100_DISPATCH_FINALIZE_RPC, point100RpcProbeArgs(POINT100_DISPATCH_FINALIZE_RPC));
  const onCertifiedPin = isRpcOnCertifiedCorePin(POINT100_DISPATCH_FINALIZE_RPC);
  const ready = onCertifiedPin && dispatchedRpc.exists;
  const note = ready
    ? `canonical ${POINT100_DISPATCH_FINALIZE_RPC} present on certified Core pin ${POINT100_CORE_PRODUCTION_VERIFIED_SHA.slice(0, 8)} / ${POINT100_PRODUCTION_MIGRATION_GATE}`
    : dispatchedRpc.exists
      ? "dispatch-finalize RPC exists but is not recognized on the certified Core pin"
      : `${POINT100_DISPATCH_FINALIZE_RPC} absent from certified Core pin ${POINT100_CORE_PRODUCTION_VERIFIED_SHA.slice(0, 8)}`;
  const blockers = productionGateBlockers();
  const upstreamNotes = blockers.length > 0 ? blockers.map((dep) => formatUpstreamBlocker(dep)) : [note];
  return { ready, note, upstreamNotes };
}

export { macro556DispatchRoutesPresent } from "../../src/lib/point100/dispatchRouteCensus";

export async function runLifecycleProbes(): Promise<Point100ProbeOutcome[]> {
  const outcomes: Point100ProbeOutcome[] = [];

  for (const stage of POINT100_LIFECYCLE_STAGES) {
    const fixture = probeFixtureKeys(stage.fixtureEnvKeys);
    const rpcNames = resolvedRpcForStage(stage);
    const rpcResults = [];

    for (const rpc of rpcNames) {
      const probe = await probeRpcExists(rpc, point100RpcProbeArgs(rpc));
      const onCertifiedPin = isRpcOnCertifiedCorePin(rpc);
      rpcResults.push({
        rpc,
        exists: probe.exists && onCertifiedPin,
        detail: onCertifiedPin ? probe.detail : `${rpc} is not bound to the certified Core pin`,
      });
    }

    outcomes.push(
      buildProbeOutcome({
        stage,
        rpcResults,
        centralBindingsPresent: stageCentralBindingsPresent(stage),
        missingFixtureKeys: fixture.missingKeys,
        executed: false,
      }),
    );
  }

  return outcomes;
}

export async function executeStageProbe(
  client: SupabaseClient,
  stageId: string,
  correlationId: string,
): Promise<{ ok: boolean; detail: string }> {
  switch (stageId) {
    case "buyer_catalogue_intent": {
      const orderId = process.env.FACTORY_CERT_GOLDEN_ORDER_ID?.trim();
      if (!orderId) return { ok: false, detail: "FACTORY_CERT_GOLDEN_ORDER_ID missing" };
      const { data, error } = await client.from("orders").select("id,status").eq("id", orderId).maybeSingle();
      if (error) return { ok: false, detail: error.message };
      if (!data) return { ok: false, detail: "golden order fixture not found" };
      return { ok: true, detail: `golden order status=${data.status}` };
    }
    case "buyer_quotation_so": {
      const orderId = process.env.FACTORY_CERT_GOLDEN_ORDER_ID?.trim();
      if (!orderId) return { ok: false, detail: "FACTORY_CERT_GOLDEN_ORDER_ID missing" };
      const { data, error } = await client
        .from("order_items")
        .select("id,quantity")
        .eq("order_id", orderId)
        .limit(1);
      if (error) return { ok: false, detail: error.message };
      if (!data?.length) return { ok: false, detail: "no order items on golden order" };
      return { ok: true, detail: `items=${data.length} qty=${data[0].quantity}` };
    }
    case "production_release": {
      const orderId = process.env.FACTORY_CERT_POINT37_ORDER_ID?.trim();
      if (!orderId) return { ok: false, detail: "FACTORY_CERT_POINT37_ORDER_ID missing" };
      const { data, error } = await client.from("orders").select("status").eq("id", orderId).maybeSingle();
      if (error) return { ok: false, detail: error.message };
      if (!data) return { ok: false, detail: "Point37 order fixture not found" };
      return { ok: true, detail: `point37 status=${data.status}` };
    }
    case "complaint_window": {
      const orderId = process.env.FACTORY_CERT_POINT38_ORDER_ID?.trim();
      if (!orderId) return { ok: false, detail: "FACTORY_CERT_POINT38_ORDER_ID missing" };
      const { data, error } = await client.rpc("get_finance_exit_facts_v1", { p_order_id: orderId });
      if (error) return { ok: false, detail: error.message };
      const row = Array.isArray(data) ? data[0] : data;
      const facts = row && typeof row === "object"
        ? row as {
            complaint_window_open?: boolean | null;
            complaint_clock_basis?: string | null;
            complaint_deadline?: string | null;
          }
        : null;
      const open = facts?.complaint_window_open ?? null;
      const basis = facts?.complaint_clock_basis ?? null;
      const deadline = facts?.complaint_deadline ?? null;
      const anchored = basis === "FINAL_INVOICE_DATE" && Boolean(deadline) && typeof open === "boolean";
      return {
        ok: anchored,
        detail: `complaint_clock_basis=${String(basis)} complaint_deadline=${String(deadline)} complaint_window_open=${String(open)}`,
      };
    }
    case "security_gate": {
      const { data, error } = await client.rpc("release_b2b_dispatch_carton_at_gate_v1", {
        p_carton_id: "00000000-0000-4000-8000-000000000099",
        p_scan_evidence_id: "00000000-0000-4000-8000-000000000098",
      });
      if (isPostgrestFunctionResolutionError(error)) {
        return { ok: false, detail: String((error as { message?: unknown }).message ?? error) };
      }
      if (error) {
        return { ok: false, detail: `unexpected gate RPC error: ${error.message}` };
      }
      const result = data as { ok?: boolean; blockers?: Array<{ code?: string }> } | null;
      const blockerCodes = Array.isArray(result?.blockers)
        ? result.blockers.map((blocker) => String(blocker?.code ?? ""))
        : [];
      const expectedRejection = result?.ok === false && blockerCodes.includes("carton_not_found");
      return {
        ok: expectedRejection,
        detail: expectedRejection
          ? "gate RPC resolved and rejected the nonexistent carton with carton_not_found"
          : `unexpected gate probe result=${JSON.stringify(data)}`,
      };
    }
    case "trace_handover": {
      const verify = await probeRpcExists("trace_verify_handover_evidence_v1", point100RpcProbeArgs("trace_verify_handover_evidence_v1"));
      const sign = await probeRpcExists("trace_sign_handover_evidence_v1", point100RpcProbeArgs("trace_sign_handover_evidence_v1"));
      const ok = verify.exists && sign.exists;
      return {
        ok,
        detail: `trace_verify=${verify.exists} trace_sign=${sign.exists}; Core#290 production-certified software contract — Trace#37/#38 merged; physical device evidence remains UAT`,
      };
    }
    default:
      return { ok: false, detail: `unsupported Point100 stage probe: ${stageId} (${correlationId})` };
  }
}
