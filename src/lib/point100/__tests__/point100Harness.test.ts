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
import { macro556DispatchRoutesPresent } from "../dispatchRouteCensus";

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
  it("keeps the final dispatch RPC canonical and permits overrides only in disposable-bootstrap mode", () => {
    const binding = bindingByKey("production_release");
    expect(binding).toBeTruthy();
    expect(resolveBoundContract(binding!)).toBe("release_order_to_in_production_v1");

    const dispatched = bindingByKey("order_dispatched");
    expect(dispatched).toBeTruthy();
    const originalOverride = process.env.POINT100_ORDER_DISPATCHED_RPC;
    const originalBootstrap = process.env.POINT100_ALLOW_DISPOSABLE_BOOTSTRAP;
    try {
      process.env.POINT100_ORDER_DISPATCHED_RPC = "custom_release_v2";
      process.env.POINT100_ALLOW_DISPOSABLE_BOOTSTRAP = "false";
      expect(() => resolveBoundContract(dispatched!)).toThrow(/must remain canonical/);

      process.env.POINT100_ALLOW_DISPOSABLE_BOOTSTRAP = "true";
      expect(resolveBoundContract(dispatched!)).toBe("custom_release_v2");

      process.env.POINT100_ALLOW_DISPOSABLE_BOOTSTRAP = "false";
      process.env.POINT100_ORDER_DISPATCHED_RPC = POINT100_DISPATCH_FINALIZE_RPC;
      expect(resolveBoundContract(dispatched!)).toBe(POINT100_DISPATCH_FINALIZE_RPC);
    } finally {
      if (originalOverride === undefined) delete process.env.POINT100_ORDER_DISPATCHED_RPC;
      else process.env.POINT100_ORDER_DISPATCHED_RPC = originalOverride;
      if (originalBootstrap === undefined) delete process.env.POINT100_ALLOW_DISPOSABLE_BOOTSTRAP;
      else process.env.POINT100_ALLOW_DISPOSABLE_BOOTSTRAP = originalBootstrap;
    }
  });
});

describe("point100 probe runner", () => {
  it("classifies missing RPC errors", () => {
    expect(isRpcMissingError("Could not find the function public.foo in the schema cache")).toBe(true);
    expect(isRpcMissingError("permission denied")).toBe(false);
  });

  it("keeps trace handover physical_uat_only while software contracts remain executable", () => {
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

  it("consumes merged inventory/Trace #37 authority but exposes current Trace #38 as a fail-closed blocker", () => {
    expect(POINT100_UPSTREAM_DEPENDENCIES.some((dep) => dep.pr === "#256" && dep.state === "merged")).toBe(true);
    expect(POINT100_UPSTREAM_DEPENDENCIES.some((dep) => dep.pr === "#259" && dep.state === "merged")).toBe(true);
    expect(POINT100_UPSTREAM_DEPENDENCIES.some((dep) => dep.pr === "#37" && dep.state === "merged")).toBe(true);
    expect(POINT100_UPSTREAM_DEPENDENCIES.some((dep) => dep.pr === "#38" && dep.state === "open_pr")).toBe(true);
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
    const traceBlockers = upstreamBlockersForStage("trace_handover");
    expect(traceBlockers).toHaveLength(1);
    expect(traceBlockers[0]?.id).toBe("oasis-trace-recovery-38");
  });

  it("records Core #290 and Production Migration Release #182 as current production authority", () => {
    const merged290 = POINT100_UPSTREAM_DEPENDENCIES.find((dep) => dep.id === "core-trace-reprint-290");
    const merged182 = POINT100_UPSTREAM_DEPENDENCIES.find((dep) => dep.id === "core-production-migration-182");
    expect(merged290?.state).toBe("merged");
    expect(merged182?.state).toBe("merged");
    const originalSha = process.env.POINT100_CORE_VERIFIED_SHA;
    process.env.POINT100_CORE_VERIFIED_SHA = POINT100_CORE_PRODUCTION_VERIFIED_SHA;
    expect(isCoreProductionVerified()).toBe(true);
    expect(isCoreDispatchProductionVerified()).toBe(true);
    process.env.POINT100_CORE_VERIFIED_SHA = POINT100_CORE_PRODUCTION_VERIFIED_SHA.slice(0, 8);
    expect(isCoreProductionVerified()).toBe(false);
    expect(isCoreDispatchProductionVerified()).toBe(false);
    if (originalSha === undefined) delete process.env.POINT100_CORE_VERIFIED_SHA;
    else process.env.POINT100_CORE_VERIFIED_SHA = originalSha;
  });

  it("records #556 as merged Central dispatch authority", () => {
    const merged556 = POINT100_UPSTREAM_DEPENDENCIES.find((dep) => dep.id === "central-macro-ops-556");
    expect(merged556?.state).toBe("merged");
    expect(merged556?.affectedStageIds).toContain("packing_cartons_dpl");
    expect(merged556?.affectedStageIds).toContain("dispatch_consignment");
  });

  it("treats dispatch finalize as certified on the current protected Core deployment", () => {
    const originalSha = process.env.POINT100_CORE_VERIFIED_SHA;
    const originalBootstrap = process.env.POINT100_ALLOW_DISPOSABLE_BOOTSTRAP;
    const originalProduction = process.env.POINT100_PRODUCTION_CERTIFICATION_PERMITTED;
    const originalDispatch = process.env.POINT100_DISPATCH_PRODUCTION_VERIFIED;
    process.env.POINT100_CORE_VERIFIED_SHA = POINT100_CORE_PRODUCTION_VERIFIED_SHA;
    process.env.POINT100_ALLOW_DISPOSABLE_BOOTSTRAP = "false";
    delete process.env.POINT100_PRODUCTION_CERTIFICATION_PERMITTED;
    delete process.env.POINT100_DISPATCH_PRODUCTION_VERIFIED;
    expect(isDisposableRehearsalMode()).toBe(false);
    expect(upstreamBlockersForStage("dispatch_consignment")).toHaveLength(0);
    expect(productionGateBlockers()).toHaveLength(0);
    expect(isRpcOnCertifiedCorePin(POINT100_DISPATCH_FINALIZE_RPC)).toBe(true);
    expect(isCoreDispatchProductionVerified()).toBe(true);
    if (originalSha === undefined) delete process.env.POINT100_CORE_VERIFIED_SHA;
    else process.env.POINT100_CORE_VERIFIED_SHA = originalSha;
    if (originalBootstrap === undefined) delete process.env.POINT100_ALLOW_DISPOSABLE_BOOTSTRAP;
    else process.env.POINT100_ALLOW_DISPOSABLE_BOOTSTRAP = originalBootstrap;
    if (originalProduction === undefined) delete process.env.POINT100_PRODUCTION_CERTIFICATION_PERMITTED;
    else process.env.POINT100_PRODUCTION_CERTIFICATION_PERMITTED = originalProduction;
    if (originalDispatch === undefined) delete process.env.POINT100_DISPATCH_PRODUCTION_VERIFIED;
    else process.env.POINT100_DISPATCH_PRODUCTION_VERIFIED = originalDispatch;
  });

  it("embeds Core #290/#182 provenance in capability matrix", () => {
    const originalSha = process.env.POINT100_CORE_VERIFIED_SHA;
    process.env.POINT100_CORE_VERIFIED_SHA = POINT100_CORE_PRODUCTION_VERIFIED_SHA;
    const matrix = buildCapabilityMatrix([], "test-env");
    expect(matrix.certification_mode).toBe("disposable_synthetic");
    expect(matrix.inventory_production_verified).toBe(true);
    expect(matrix.dispatch_production_verified).toBe(true);
    expect(matrix.pending_core_recert_pr).toBeNull();
    expect(matrix.core_verified_sha).toBe(POINT100_CORE_PRODUCTION_VERIFIED_SHA);
    expect(matrix.production_migration_gate).toBe(POINT100_PRODUCTION_MIGRATION_GATE);
    expect(matrix.production_migration_run_id).toBe(POINT100_PRODUCTION_MIGRATION_RUN_ID);
    expect(resolveProductionMigrationRunId()).toBe(POINT100_PRODUCTION_MIGRATION_RUN_ID);
    expect(POINT100_CORE_PENDING_DISPATCH_PR).toBe("#260");
    if (originalSha === undefined) delete process.env.POINT100_CORE_VERIFIED_SHA;
    else process.env.POINT100_CORE_VERIFIED_SHA = originalSha;
  });

  it("binds #556 canonical dispatch workflow routes in Central census", () => {
    const census = macro556DispatchRoutesPresent();
    expect(census.ok, census.detail).toBe(true);
  });
});
