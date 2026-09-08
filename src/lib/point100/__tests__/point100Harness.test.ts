import { describe, expect, it } from "vitest";
import { buildCapabilityMatrix, summarizeCapabilityMatrix } from "../capabilityStatus";
import { POINT100_LIFECYCLE_STAGES, POINT100_NEGATIVE_PATHS, stagesForNegativePath } from "../lifecycleStages";
import { bindingByKey, resolveBoundContract } from "../contractBindings";
import { buildProbeOutcome, isRpcMissingError, probeFixtureKeys, resolvedRpcForStage } from "../probeRunner";
import {
  POINT100_UPSTREAM_DEPENDENCIES,
  POINT100_TRACE_SOFTWARE_RPCS,
  upstreamBlockersForStage,
  productionGateBlockers,
  isDisposableRehearsalMode,
  POINT100_PRODUCTION_MIGRATION_GATE,
  POINT100_CORE_PRODUCTION_VERIFIED_SHA,
  POINT100_PRODUCTION_MIGRATION_RUN_ID,
  isCoreProductionVerified,
  isCoreDispatchProductionVerified,
  isRpcOnCertifiedCorePin,
  POINT100_CORE_PENDING_DISPATCH_PR,
  POINT100_DISPATCH_FINALIZE_RPC,
  resolveProductionMigrationRunId,
} from "../upstreamDependencies";
import { CENTRAL_ADMIN_MODULE_AUTHORITY_MATRIX } from "../../appverse/centralAdminModuleAuthorityMatrix";
import { MACRO_DISPATCH_MANAGER_HOME, MACRO_ORDER_DISPATCH_JOURNEY } from "../../macro-order-dispatch/macroOrderDispatchJourney";

describe("point100 lifecycle stages", () => {
  it("defines 16 sequential stages covering the full operational lifecycle", () => {
    expect(POINT100_LIFECYCLE_STAGES).toHaveLength(16);
    const sequences = POINT100_LIFECYCLE_STAGES.map((stage) => stage.sequence);
    expect(sequences).toEqual([...sequences].sort((a, b) => a - b));
    expect(new Set(sequences).size).toBe(16);
  });

  it("maps every negative path to at least one lifecycle stage", () => {
    for (const negative of POINT100_NEGATIVE_PATHS) {
      expect(stagesForNegativePath(negative.id).length).toBeGreaterThan(0);
    }
  });
});

describe("point100 contract bindings", () => {
  it("resolves canonical RPC unless env override is set", () => {
    const binding = bindingByKey("production_release");
    expect(binding).toBeTruthy();
    expect(resolveBoundContract(binding!)).toBe("release_order_to_in_production_v1");
    process.env.POINT100_ORDER_DISPATCHED_RPC = "custom_release_v2";
    const dispatched = bindingByKey("order_dispatched");
    expect(resolveBoundContract(dispatched!)).toBe("custom_release_v2");
    delete process.env.POINT100_ORDER_DISPATCHED_RPC;
  });
});

describe("point100 probe runner", () => {
  it("classifies missing RPC errors", () => {
    expect(isRpcMissingError("Could not find the function public.foo in the schema cache")).toBe(true);
    expect(isRpcMissingError("permission denied")).toBe(false);
  });

  it("marks trace handover as physical_uat_only when Trace #37 recert is open", () => {
    const stage = POINT100_LIFECYCLE_STAGES.find((s) => s.id === "trace_handover")!;
    const outcome = buildProbeOutcome({
      stage,
      rpcResults: POINT100_TRACE_SOFTWARE_RPCS.map((rpc) => ({ rpc, exists: true, detail: "ok" })),
      centralBindingsPresent: true,
      missingFixtureKeys: [],
      executed: false,
    });
    expect(outcome.status).toBe("physical_uat_only");
    expect(outcome.executable).toBe(true);
  });

  it("summarizes capability matrix counts", () => {
    const probes = [
      buildProbeOutcome({
        stage: POINT100_LIFECYCLE_STAGES[0],
        rpcResults: [{ rpc: "add_customer_order_draft_line_v1", exists: true, detail: "ok" }],
        centralBindingsPresent: true,
        missingFixtureKeys: [],
        executed: true,
        executionDetail: "ok",
      }),
      buildProbeOutcome({
        stage: POINT100_LIFECYCLE_STAGES.find((s) => s.id === "trace_handover")!,
        rpcResults: POINT100_TRACE_SOFTWARE_RPCS.map((rpc) => ({ rpc, exists: true, detail: "ok" })),
        centralBindingsPresent: true,
        missingFixtureKeys: [],
        executed: false,
      }),
    ];
    const summary = summarizeCapabilityMatrix(probes);
    expect(summary.total).toBe(2);
    expect(summary.physical_uat_only).toBe(1);
    const matrix = buildCapabilityMatrix(probes, "test-env");
    expect(matrix.fail_closed).toBe(true);
    expect(matrix.environment_id).toBe("test-env");
  });

  it("resolves stage RPCs through contract bindings", () => {
    const stage = POINT100_LIFECYCLE_STAGES.find((s) => s.id === "production_release")!;
    expect(resolvedRpcForStage(stage)).toContain("release_order_to_in_production_v1");
    const traceStage = POINT100_LIFECYCLE_STAGES.find((s) => s.id === "trace_handover")!;
    expect(resolvedRpcForStage(traceStage)).toContain("trace_verify_handover_evidence_v1");
  });

  it("detects missing fixture env keys", () => {
    const original = process.env.FACTORY_CERT_GOLDEN_ORDER_ID;
    delete process.env.FACTORY_CERT_GOLDEN_ORDER_ID;
    const result = probeFixtureKeys(["FACTORY_CERT_GOLDEN_ORDER_ID"]);
    expect(result.satisfied).toBe(false);
    expect(result.missingKeys).toContain("FACTORY_CERT_GOLDEN_ORDER_ID");
    if (original) process.env.FACTORY_CERT_GOLDEN_ORDER_ID = original;
  });

  it("consumes Core#259 inventory authority without upstream blockers", () => {
    expect(POINT100_UPSTREAM_DEPENDENCIES.some((dep) => dep.pr === "#256" && dep.state === "merged")).toBe(true);
    expect(POINT100_UPSTREAM_DEPENDENCIES.some((dep) => dep.pr === "#259" && dep.state === "merged")).toBe(true);
    expect(POINT100_UPSTREAM_DEPENDENCIES.some((dep) => dep.pr === "#37")).toBe(true);
    const inventoryStage = POINT100_LIFECYCLE_STAGES.find((s) => s.id === "inventory_lot_allocation")!;
    const outcome = buildProbeOutcome({
      stage: inventoryStage,
      rpcResults: [
        { rpc: "reserve_rgs_stock", exists: true, detail: "ok" },
        { rpc: "allocate_b2b_inventory_putaway", exists: true, detail: "ok" },
        { rpc: "record_inventory_lot_exception", exists: true, detail: "ok" },
      ],
      centralBindingsPresent: true,
      missingFixtureKeys: [],
      executed: false,
    });
    expect(outcome.status).toBe("implemented");
    expect(upstreamBlockersForStage("trace_handover")[0]?.failClosedStatus).toBe("physical_uat_only");
  });

  it("records #259 and #161 as production-certified Core authority", () => {
    const merged259 = POINT100_UPSTREAM_DEPENDENCIES.find((dep) => dep.id === "core-macro-trace-259");
    const merged161 = POINT100_UPSTREAM_DEPENDENCIES.find((dep) => dep.id === "core-production-migration-161");
    expect(merged259?.state).toBe("merged");
    expect(merged161?.state).toBe("merged");
    const originalSha = process.env.POINT100_CORE_VERIFIED_SHA;
    process.env.POINT100_CORE_VERIFIED_SHA = POINT100_CORE_PRODUCTION_VERIFIED_SHA;
    expect(isCoreProductionVerified()).toBe(true);
    expect(upstreamBlockersForStage("inventory_lot_allocation")).toHaveLength(0);
    if (originalSha === undefined) delete process.env.POINT100_CORE_VERIFIED_SHA;
    else process.env.POINT100_CORE_VERIFIED_SHA = originalSha;
  });

  it("records #556 as merged Central dispatch authority", () => {
    const merged556 = POINT100_UPSTREAM_DEPENDENCIES.find((dep) => dep.id === "central-macro-ops-556");
    expect(merged556?.state).toBe("merged");
    expect(merged556?.affectedStageIds).toContain("packing_cartons_dpl");
    expect(merged556?.affectedStageIds).toContain("dispatch_consignment");
  });

  it("keeps dispatch finalize blocked pending Core #260 even in disposable rehearsal", () => {
    const originalBootstrap = process.env.POINT100_ALLOW_DISPOSABLE_BOOTSTRAP;
    const originalProduction = process.env.POINT100_PRODUCTION_CERTIFICATION_PERMITTED;
    const originalDispatch = process.env.POINT100_DISPATCH_PRODUCTION_VERIFIED;
    process.env.POINT100_ALLOW_DISPOSABLE_BOOTSTRAP = "true";
    delete process.env.POINT100_PRODUCTION_CERTIFICATION_PERMITTED;
    delete process.env.POINT100_DISPATCH_PRODUCTION_VERIFIED;
    expect(isDisposableRehearsalMode()).toBe(true);
    expect(upstreamBlockersForStage("dispatch_consignment")).toHaveLength(1);
    expect(upstreamBlockersForStage("dispatch_consignment")[0]?.id).toBe("core-macro-dispatch-260");
    expect(productionGateBlockers().some((dep) => dep.id === "core-macro-dispatch-260")).toBe(true);
    expect(isRpcOnCertifiedCorePin(POINT100_DISPATCH_FINALIZE_RPC)).toBe(false);
    expect(isCoreDispatchProductionVerified()).toBe(false);
    if (originalBootstrap === undefined) delete process.env.POINT100_ALLOW_DISPOSABLE_BOOTSTRAP;
    else process.env.POINT100_ALLOW_DISPOSABLE_BOOTSTRAP = originalBootstrap;
    if (originalProduction === undefined) delete process.env.POINT100_PRODUCTION_CERTIFICATION_PERMITTED;
    else process.env.POINT100_PRODUCTION_CERTIFICATION_PERMITTED = originalProduction;
    if (originalDispatch === undefined) delete process.env.POINT100_DISPATCH_PRODUCTION_VERIFIED;
    else process.env.POINT100_DISPATCH_PRODUCTION_VERIFIED = originalDispatch;
  });

  it("embeds Core #259 provenance in capability matrix", () => {
    const originalSha = process.env.POINT100_CORE_VERIFIED_SHA;
    process.env.POINT100_CORE_VERIFIED_SHA = POINT100_CORE_PRODUCTION_VERIFIED_SHA;
    const matrix = buildCapabilityMatrix([], "test-env");
    expect(matrix.certification_mode).toBe("disposable_synthetic");
    expect(matrix.inventory_production_verified).toBe(true);
    expect(matrix.dispatch_production_verified).toBe(false);
    expect(matrix.pending_core_recert_pr).toBe(POINT100_CORE_PENDING_DISPATCH_PR);
    expect(matrix.core_verified_sha).toBe(POINT100_CORE_PRODUCTION_VERIFIED_SHA);
    expect(matrix.production_migration_gate).toBe(POINT100_PRODUCTION_MIGRATION_GATE);
    expect(matrix.production_migration_run_id).toBe(POINT100_PRODUCTION_MIGRATION_RUN_ID);
    expect(resolveProductionMigrationRunId()).toBe(POINT100_PRODUCTION_MIGRATION_RUN_ID);
    if (originalSha === undefined) delete process.env.POINT100_CORE_VERIFIED_SHA;
    else process.env.POINT100_CORE_VERIFIED_SHA = originalSha;
  });

  it("binds #556 canonical dispatch workflow routes in Central census", () => {
    const routes = new Set(CENTRAL_ADMIN_MODULE_AUTHORITY_MATRIX.map((entry) => entry.route));
    const required = [
      MACRO_DISPATCH_MANAGER_HOME,
      ...MACRO_ORDER_DISPATCH_JOURNEY.filter((stage) =>
        ["dispatch_readiness", "packing_dpl", "golden_chain", "security_gate"].includes(stage.key),
      ).map((stage) => stage.route),
      "/admin/dispatch-completion",
      "/admin/dispatch-finalization",
    ];
    for (const route of required) {
      expect(routes.has(route), `missing route ${route}`).toBe(true);
    }
  });
});
