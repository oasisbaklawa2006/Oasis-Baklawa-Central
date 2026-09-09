import type { SupabaseClient } from "@supabase/supabase-js";
import type { Point100ProbeOutcome } from "../../src/lib/point100/capabilityStatus";
import { POINT100_LIFECYCLE_STAGES } from "../../src/lib/point100/lifecycleStages";
import { buildProbeOutcome, probeFixtureKeys, resolvedRpcForStage } from "../../src/lib/point100/probeRunner";
import { isRpcOnCertifiedCorePin } from "../../src/lib/point100/upstreamDependencies";
import { CENTRAL_ADMIN_MODULE_AUTHORITY_MATRIX } from "../../src/lib/appverse/centralAdminModuleAuthorityMatrix";
import { MACRO_DISPATCH_MANAGER_HOME, MACRO_ORDER_DISPATCH_JOURNEY } from "../../src/lib/macro-order-dispatch/macroOrderDispatchJourney";
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

export function macro556DispatchRoutesPresent(): { ok: boolean; detail: string } {
  const required = [
    MACRO_DISPATCH_MANAGER_HOME,
    ...MACRO_ORDER_DISPATCH_JOURNEY.filter((stage) =>
      ["dispatch_readiness", "packing_dpl", "golden_chain", "security_gate"].includes(stage.key),
    ).map((stage) => stage.route),
    "/admin/dispatch-completion",
    "/admin/dispatch-finalization",
  ];
  const missing = required.filter((route) => !CENTRAL_ROUTE_BINDINGS.has(route));
  if (missing.length > 0) {
    return { ok: false, detail: `Missing #556 dispatch routes: ${missing.join(", ")}` };
  }
  return { ok: true, detail: `#556 routes present: ${required.join(", ")}` };
}

export async function runLifecycleProbes(): Promise<Point100ProbeOutcome[]> {
  const outcomes: Point100ProbeOutcome[] = [];

  for (const stage of POINT100_LIFECYCLE_STAGES) {
    const fixture = probeFixtureKeys(stage.fixtureEnvKeys);
    const rpcNames = resolvedRpcForStage(stage);
    const rpcResults = [];

    for (const rpc of rpcNames) {
      const probe = await probeRpcExists(rpc);
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
        return { ok: true, detail: `RPC signature resolved; fail-closed probe rejected as expected: ${error.message}` };
      }
      return { ok: true, detail: `RPC signature resolved; probe result=${JSON.stringify(data)}` };
    }
    case "trace_handover": {
      const verify = await probeRpcExists("trace_verify_handover_evidence_v1");
      const sign = await probeRpcExists("trace_sign_handover_evidence_v1");
      const ok = verify.exists && sign.exists;
      return {
        ok,
        detail: `trace_verify=${verify.exists} trace_sign=${sign.exists}; Core#260 production-certified software contract — Trace#37 software merged; physical device evidence remains UAT`,
      };
    }
    default:
      return { ok: false, detail: `unsupported Point100 stage probe: ${stageId} (${correlationId})` };
  }
}
