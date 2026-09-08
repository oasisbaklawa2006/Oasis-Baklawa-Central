import type { Point100CapabilityStatus, Point100ProbeOutcome } from "./capabilityStatus";
import type { Point100LifecycleStage } from "./lifecycleStages";
import { resolveBoundContract, bindingByKey } from "./contractBindings";
import {
  formatUpstreamBlocker,
  isDisposableRehearsalMode,
  upstreamBlockersForStage,
} from "./upstreamDependencies";

export type RpcProbeResult = {
  rpc: string;
  exists: boolean;
  detail: string;
};

export type FixtureProbeResult = {
  missingKeys: string[];
  satisfied: boolean;
};

export function isRpcMissingError(message: string): boolean {
  const normalized = message.toLowerCase();
  return (
    normalized.includes("could not find the function") ||
    normalized.includes("function") && normalized.includes("does not exist") ||
    normalized.includes("42883") ||
    normalized.includes("pgrst202")
  );
}

export function isProviderRuntimeError(message: string): boolean {
  const normalized = message.toLowerCase();
  return (
    normalized.includes("whatsapp") ||
    normalized.includes("payment provider") ||
    normalized.includes("webhook secret") ||
    normalized.includes("provider_runtime")
  );
}

export function classifyProbeFailure(
  stage: Point100LifecycleStage,
  errorMessage: string,
  missingFixtureKeys: string[],
): Point100CapabilityStatus {
  if (missingFixtureKeys.length > 0) return "preview_secret_missing";
  if (stage.domain === "trace" && stage.coreRpcs.length === 0) return "physical_uat_only";
  if (isProviderRuntimeError(errorMessage)) return "provider_runtime_missing";
  if (isRpcMissingError(errorMessage)) return "upstream_contract_missing";
  return "implemented";
}

export function probeFixtureKeys(keys: readonly string[]): FixtureProbeResult {
  const missingKeys = keys.filter((key) => !process.env[key]?.trim());
  return { missingKeys, satisfied: missingKeys.length === 0 };
}

export function buildProbeOutcome(input: {
  stage: Point100LifecycleStage;
  rpcResults: RpcProbeResult[];
  centralBindingsPresent: boolean;
  missingFixtureKeys: string[];
  executed: boolean;
  executionDetail?: string;
}): Point100ProbeOutcome {
  const { stage, rpcResults, centralBindingsPresent, missingFixtureKeys, executed, executionDetail } = input;
  const missingRpcs = rpcResults.filter((result) => !result.exists).map((result) => result.rpc);
  const upstream = upstreamBlockersForStage(stage.id);

  let status: Point100CapabilityStatus;
  let detail: string;

  const upstreamDep = upstream[0];
  if (upstreamDep) {
    status = upstreamDep.failClosedStatus;
    detail = formatUpstreamBlocker(upstreamDep);
    if (stage.id === "trace_handover" && missingRpcs.length === 0 && upstreamDep.id === "oasis-trace-macro-37") {
      detail = `${formatUpstreamBlocker(upstreamDep)} Software contracts present on Core #259; physical handover PASS not claimed.`;
    }
  } else if (stage.id === "trace_handover" && missingRpcs.length > 0) {
    status = "upstream_contract_missing";
    detail = `Core #259 trace software RPC unavailable: ${missingRpcs.join(", ")}`;
  } else if (stage.domain === "trace" && stage.id === "trace_handover") {
    status = "physical_uat_only";
    detail = "Trace scanner/device handover requires Leap 13 physical UAT; Central scan-timeline projection is software-only.";
  } else if (missingFixtureKeys.length > 0) {
    status = "preview_secret_missing";
    detail = `Missing fixture env: ${missingFixtureKeys.join(", ")}`;
  } else if (missingRpcs.length > 0) {
    status = "upstream_contract_missing";
    detail = `Core RPC unavailable: ${missingRpcs.join(", ")}`;
  } else if (!centralBindingsPresent) {
    status = "upstream_contract_missing";
    detail = `Central binding missing for stage ${stage.id}`;
  } else if (executed) {
    status = "implemented";
    detail = executionDetail ?? "Executable probe passed";
  } else {
    status = "implemented";
    detail = isDisposableRehearsalMode()
      ? "Contract present on disposable Core replay at SHA c89c538c; dispatch finalize RPC remains bootstrap-only"
      : "Contract present; full journey execution deferred to dress-rehearsal stage";
  }

  const contractReady =
    missingFixtureKeys.length === 0 && missingRpcs.length === 0 && centralBindingsPresent;

  const technicalReady = contractReady && stage.domain !== "trace";

  // Trace #37 device recert is fail-closed, but Core #259 trace_*_v1 software contracts remain probeable.
  const traceSoftwareReady = stage.id === "trace_handover" && contractReady;

  const executable = technicalReady || traceSoftwareReady;

  return {
    stageId: stage.id,
    status,
    centralBinding: stage.centralBindings[0] ?? null,
    coreRpc: stage.coreRpcs[0] ?? null,
    detail,
    probeAt: new Date().toISOString(),
    executable,
  };
}

/** Map stage to primary contract binding key for rebinding checks. */
export function primaryBindingKeyForStage(stageId: string): string | null {
  const map: Record<string, string> = {
    buyer_catalogue_intent: "buyer_draft_line",
    buyer_quotation_so: "buyer_submit_order",
    advance_payable_payment: "payment_proof",
    finance_verification_reconciliation: "payment_verify",
    production_release: "production_release",
    inventory_lot_allocation: "rgs_reserve",
    packing_cartons_dpl: "dispatch_consignment",
    final_invoice_balance: "final_invoice",
    finance_dispatch_clearance: "finance_dispatch_clearance",
    dispatch_consignment: "dispatch_proof",
    security_gate: "gate_release",
    customer_dispatch_proof: "dispatch_proof",
    order_complete: "order_dispatched",
    complaint_window: "finance_exit_facts",
    trace_handover: "trace_verify_handover",
  };
  return map[stageId] ?? null;
}

export function resolvedRpcForStage(stage: Point100LifecycleStage): string[] {
  const bindingKey = primaryBindingKeyForStage(stage.id);
  if (!bindingKey) return [...stage.coreRpcs];
  const binding = bindingByKey(bindingKey);
  if (!binding) return [...stage.coreRpcs];
  return [resolveBoundContract(binding), ...stage.coreRpcs.filter((rpc) => rpc !== binding.canonical)];
}
