import type { SupabaseClient } from "@supabase/supabase-js";
import type { Point100ProbeOutcome } from "../../src/lib/point100/capabilityStatus";
import { POINT100_LIFECYCLE_STAGES } from "../../src/lib/point100/lifecycleStages";
import { buildProbeOutcome, probeFixtureKeys, resolvedRpcForStage } from "../../src/lib/point100/probeRunner";
import { CENTRAL_ADMIN_MODULE_AUTHORITY_MATRIX } from "../../src/lib/appverse/centralAdminModuleAuthorityMatrix";
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

function centralBindingPresent(binding: string): boolean {
  if (binding.startsWith("/")) {
    if (CENTRAL_ROUTE_BINDINGS.has(binding)) return true;
    // Wildcard census entries such as /buyer/* cover nested buyer routes.
    return CENTRAL_ROUTE_BINDINGS.has(`${binding.split("/").slice(0, 2).join("/")}/*`);
  }
  if (binding.includes(".")) return true;
  return CENTRAL_CLIENT_BINDINGS.has(binding);
}

function stageCentralBindingsPresent(stage: typeof POINT100_LIFECYCLE_STAGES[number]): boolean {
  return stage.centralBindings.every((binding) => centralBindingPresent(binding));
}

export async function runLifecycleProbes(): Promise<Point100ProbeOutcome[]> {
  const outcomes: Point100ProbeOutcome[] = [];

  for (const stage of POINT100_LIFECYCLE_STAGES) {
    const fixture = probeFixtureKeys(stage.fixtureEnvKeys);
    const rpcNames = resolvedRpcForStage(stage);
    const rpcResults = [];

    for (const rpc of rpcNames) {
      const probe = await probeRpcExists(rpc);
      rpcResults.push({ rpc, exists: probe.exists, detail: probe.detail });
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
      return { ok: true, detail: `point37 status=${data?.status ?? "missing"}` };
    }
    case "complaint_window": {
      const orderId = process.env.FACTORY_CERT_POINT38_ORDER_ID?.trim();
      if (!orderId) return { ok: false, detail: "FACTORY_CERT_POINT38_ORDER_ID missing" };
      const { data, error } = await client.rpc("get_finance_exit_facts_v1", { p_order_id: orderId });
      if (error) return { ok: false, detail: error.message };
      const row = Array.isArray(data) ? data[0] : data;
      const open = row && typeof row === "object" ? (row as { complaint_window_open?: boolean }).complaint_window_open : null;
      return { ok: true, detail: `complaint_window_open=${String(open)}` };
    }
    case "security_gate": {
      const probe = await probeRpcExists("release_b2b_dispatch_carton_at_gate_v1");
      return { ok: probe.exists, detail: probe.detail };
    }
    default:
      return { ok: true, detail: `stage ${stageId} contract probe only (${correlationId})` };
  }
}
