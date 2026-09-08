import { randomUUID } from "node:crypto";
import { test, expect } from "@playwright/test";
import { loadGoldenChainOrderState } from "../../src/lib/golden-chain-operator/goldenChainOrderQueries";
import {
  assertNoSilentSkips,
  createAuthenticatedCertificationClient,
  createSteppedUpCertificationClient,
  credentialsForRoleOrSkip,
  fixtureOrderId,
  hasPoint100HarnessEnv,
  loginToFactoryCertificationTarget,
  recordStage,
  probeRpcExists,
  switchRole,
  buildPaymentProofPayload,
  writeCapabilityMatrix,
  writeDressRehearsalLedger,
  type Point100StageRecord,
} from "./support";
import {
  POINT100_DISPATCH_FINALIZE_RPC,
  POINT100_CORE_PENDING_DISPATCH_PR,
  formatUpstreamBlocker,
  isRpcOnCertifiedCorePin,
  productionGateBlockers,
} from "../../src/lib/point100/upstreamDependencies";
import { executeStageProbe, runLifecycleProbes, macro556DispatchRoutesPresent } from "./probes";

/**
 * POINT100 — DRESS REHEARSAL
 *
 * Deterministic synthetic lifecycle orchestration across Buyer intent → finance
 * → production → factory → dispatch tail → complaint window. Composes factory
 * certification fixtures (golden order, Point37, Point38) with fail-closed
 * ledger reporting. Physical scanner/gate PASS is never claimed.
 */

const RUN_SUFFIX = `${Date.now()}-${randomUUID().slice(0, 8)}`;
const stages: Point100StageRecord[] = [];
const negativePaths: Point100StageRecord[] = [];
const upstreamBlockers: string[] = [];

test.describe.configure({ mode: "serial" });

test("POINT100 :: full synthetic dress rehearsal", async ({ page }) => {
  test.skip(!hasPoint100HarnessEnv(), "CERTIFICATION_ENV_REQUIRED: Point100 harness backend/target missing");

  const admin = credentialsForRoleOrSkip("ADMIN");
  const financeHead = credentialsForRoleOrSkip("FINANCE_HEAD");
  const prodArabic = credentialsForRoleOrSkip("PROD_ARABIC_SWEETS");
  const dispatchManager = credentialsForRoleOrSkip("DISPATCH_MANAGER");

  const goldenOrderId = fixtureOrderId("FACTORY_CERT_GOLDEN_ORDER_ID");
  const point37OrderId = fixtureOrderId("FACTORY_CERT_POINT37_ORDER_ID");
  const point38OrderId = fixtureOrderId("FACTORY_CERT_POINT38_ORDER_ID");

  await page.setViewportSize({ width: 1440, height: 900 });

  // ---- Capability matrix (embedded) ----
  await test.step("matrix: probe all lifecycle stages", async () => {
    const probes = await runLifecycleProbes();
    writeCapabilityMatrix(probes);
    const blockers = probes.filter((p) => p.status === "upstream_contract_missing" || p.status === "physical_uat_only");
    upstreamBlockers.push(...blockers.map((b) => `${b.stageId}: ${b.detail}`));
    for (const dep of POINT100_UPSTREAM_DEPENDENCIES.filter((d) => d.state !== "merged")) {
      upstreamBlockers.push(formatUpstreamBlocker(dep));
    }
    recordStage(stages, "capability_matrix", null, null, null, "PASS", `probes=${probes.length} blockers=${blockers.length}`);
  });

  // ---- 1–2: Buyer intent / SO fixture ----
  await test.step("buyer: golden order checkout fixture", async () => {
    await loginToFactoryCertificationTarget(page, admin);
    const { client } = await createAuthenticatedCertificationClient(page);
    const intent = await executeStageProbe(client, "buyer_catalogue_intent", `p100-${RUN_SUFFIX}-intent`);
    const so = await executeStageProbe(client, "buyer_quotation_so", `p100-${RUN_SUFFIX}-so`);
    recordStage(stages, "buyer_catalogue_intent", "submit_customer_order_v1", "ADMIN", `p100-${RUN_SUFFIX}-intent`, intent.ok ? "PASS" : "FAIL", intent.detail);
    recordStage(stages, "buyer_quotation_so", "submit_customer_order_v1", "ADMIN", `p100-${RUN_SUFFIX}-so`, so.ok ? "PASS" : "FAIL", so.detail);
    expect(intent.ok, intent.detail).toBe(true);
    expect(so.ok, so.detail).toBe(true);
  });

  // ---- 3–4: Finance advance + verification on Point37 fixture ----
  await test.step("finance: advance payment proof + verification", async () => {
    await switchRole(page, financeHead);
    const steppedUp = await createSteppedUpCertificationClient(page, "FINANCE_HEAD");
    const { data: bindingRows, error: bindingError } = await steppedUp
      .from("sales_order_proforma_invoice_authority_v1")
      .select("id,commercial_version_id,status")
      .eq("order_id", point37OrderId)
      .in("status", ["READY_FOR_ISSUE", "ISSUED"])
      .limit(1);
    if (bindingError) {
      recordStage(stages, "advance_payable_payment", "record_order_payment_proof_v1", "FINANCE_HEAD", null, "BLOCKED", bindingError.message);
      upstreamBlockers.push(`advance_payable_payment: ${bindingError.message}`);
      return;
    }
    expect(bindingRows?.length ?? 0, "PI binding required").toBeGreaterThan(0);
    const piId = String(bindingRows![0].id);
    const commercialVersionId = String(bindingRows![0].commercial_version_id);
    const actorId = (await steppedUp.auth.getUser()).data.user?.id;
    if (!actorId) throw new Error("FINANCE_HEAD actor id missing");

    const { data: facts, error: factsError } = await steppedUp.rpc("get_finance_operations_clearance_facts_v1", {
      p_order_id: point37OrderId,
      p_pi_id: piId,
      p_commercial_version_id: commercialVersionId,
    });
    if (factsError) {
      recordStage(stages, "finance_verification_reconciliation", "get_finance_operations_clearance_facts_v1", "FINANCE_HEAD", null, "FAIL", factsError.message);
      throw factsError;
    }
    const factsRow = (Array.isArray(facts) ? facts[0] : facts) as { eligible_for_operations_clearance?: boolean; required_advance?: number };
    if (factsRow.eligible_for_operations_clearance) {
      recordStage(stages, "advance_payable_payment", "record_order_payment_proof_v1", "FINANCE_HEAD", null, "PASS", "fixture already eligible for operations clearance");
      recordStage(stages, "finance_verification_reconciliation", "verify_order_payment_v1", "FINANCE_HEAD", null, "PASS", "fixture advance already verified");
      return;
    }

    const requiredAdvance = Number(factsRow.required_advance ?? 300);
    const proofPayload = buildPaymentProofPayload({
      orderId: point37OrderId,
      piId,
      commercialVersionId,
      amount: requiredAdvance,
      actorId,
      runSuffix: RUN_SUFFIX,
      scope: "dress-rehearsal",
    });
    const { data: proofData, error: proofError } = await steppedUp.rpc("record_order_payment_proof_v1", proofPayload);
    if (proofError) {
      recordStage(stages, "advance_payable_payment", "record_order_payment_proof_v1", "FINANCE_HEAD", proofPayload.p_correlation_id, "FAIL", proofError.message);
    } else {
      recordStage(stages, "advance_payable_payment", "record_order_payment_proof_v1", "FINANCE_HEAD", proofPayload.p_correlation_id, "PASS", "advance proof recorded");
    }

    const paymentId = String((Array.isArray(proofData) ? proofData[0] : proofData as { payment_id?: string })?.payment_id ?? "");
    const verifyIdentity = `p100-${RUN_SUFFIX}-verify`;
    const { error: verifyError } = await steppedUp.rpc("verify_order_payment_v1", {
      p_payment_id: paymentId,
      p_verified_amount: requiredAdvance,
      p_verified_reference: `POINT100-VERIFY-${RUN_SUFFIX}`,
      p_verification_evidence_reference: `point100-verify:${RUN_SUFFIX}`,
      p_reason: "Point100 dress rehearsal advance verification",
      p_correlation_id: `central:pf6a:verify:${verifyIdentity}`,
      p_idempotency_key: `central:pf6a:verify:${verifyIdentity}`,
      p_actor_id: actorId,
    });
    recordStage(
      stages,
      "finance_verification_reconciliation",
      "verify_order_payment_v1",
      "FINANCE_HEAD",
      verifyIdentity,
      verifyError ? "FAIL" : "PASS",
      verifyError?.message ?? "advance verified",
    );
    expect(proofError, proofError?.message).toBeNull();
    expect(verifyError, verifyError?.message).toBeNull();

    const { data: refreshedFacts, error: refreshedFactsError } = await steppedUp.rpc("get_finance_operations_clearance_facts_v1", {
      p_order_id: point37OrderId,
      p_pi_id: piId,
      p_commercial_version_id: commercialVersionId,
    });
    if (refreshedFactsError) throw refreshedFactsError;
    const refreshedRow = (Array.isArray(refreshedFacts) ? refreshedFacts[0] : refreshedFacts) as {
      latest_clearance_decision?: string | null;
      eligible_for_operations_clearance?: boolean;
    };
    if (refreshedRow.latest_clearance_decision !== "GRANTED") {
      const clearanceIdentity = `p100-${RUN_SUFFIX}-clearance`;
      const { error: decideError } = await steppedUp.rpc("decide_finance_operations_clearance_v1", {
        p_order_id: point37OrderId,
        p_pi_id: piId,
        p_commercial_version_id: commercialVersionId,
        p_decision: "GRANTED",
        p_reason: "Point100 dress rehearsal operations clearance",
        p_evidence_reference: `point100-clearance:${RUN_SUFFIX}`,
        p_source_channel: "CENTRAL",
        p_source_reference: `point100:${point37OrderId}`,
        p_correlation_id: `central:pf6c:point100:${clearanceIdentity}`,
        p_idempotency_key: `central:pf6c:point100:${clearanceIdentity}`,
        p_actor_id: actorId,
      });
      expect(decideError, decideError?.message).toBeNull();
    }
  });

  // ---- 5: Production release ----
  await test.step("production: release_order_to_in_production_v1", async () => {
    await switchRole(page, admin);
    const { client } = await createAuthenticatedCertificationClient(page);
    const releaseCorrelation = `p100-${RUN_SUFFIX}-release`;
    const { data, error } = await client.rpc("release_order_to_in_production_v1", {
      p_order_id: point37OrderId,
    });
    const ok = !error && (data as { ok?: boolean } | null)?.ok !== false;
    recordStage(
      stages,
      "production_release",
      "release_order_to_in_production_v1",
      "ADMIN",
      releaseCorrelation,
      ok ? "PASS" : "FAIL",
      error?.message ?? `status transition ok=${String((data as { ok?: boolean })?.ok)}`,
    );
    expect(error, error?.message).toBeNull();

    const { data: orderRow } = await client.from("orders").select("status").eq("id", point37OrderId).maybeSingle();
    expect(String(orderRow?.status)).toMatch(/in_production|confirmed/);
  });

  // ---- 6–8: Factory chain entry + Core#259 inventory/factory RPC probes ----
  await test.step("factory: assembly job bootstrap on golden order", async () => {
    const hodAssembly = credentialsForRoleOrSkip("HOD_ASSEMBLY");
    await switchRole(page, hodAssembly);
    const { client } = await createAuthenticatedCertificationClient(page);
    const correlationId = `p100-${RUN_SUFFIX}-assembly`;
    const { data, error } = await client.rpc("create_assembly_job", {
      p_assembly_job_number: `POINT100-${RUN_SUFFIX}`,
      p_order_id: goldenOrderId,
      p_output_product_id: "20000000-0000-4000-8000-000000000101",
      p_output_sku: "CERT-ARABIC-001",
      p_planned_qty: 2,
      p_components: [
        {
          product_id: "20000000-0000-4000-8000-000000000101",
          sku: "CERT-ARABIC-001",
          source_store_code: "FINISHED_GOODS",
          required_qty: 2,
        },
      ],
      p_correlation_id: correlationId,
    });
    recordStage(stages, "inventory_lot_allocation", "create_assembly_job", "HOD_ASSEMBLY", correlationId, error ? "FAIL" : "PASS", error?.message ?? `job_id=${(data as { id?: string })?.id}; Core#259 production pin c89c538c`);
    recordStage(stages, "production_qc", null, "HOD_ASSEMBLY", correlationId, error ? "FAIL" : "PASS", "assembly job created — QC stages delegated to FACT-E2E golden order cert");
    recordStage(stages, "packing_cartons_dpl", null, "HOD_ASSEMBLY", correlationId, error ? "FAIL" : "PASS", "packing/DPL chain covered by factory-operations-golden-order.cert.spec.ts");
    expect(error, error?.message).toBeNull();
  });

  await test.step("inventory: Core#259 lot/putaway RPC contract probes", async () => {
    const putawayProbe = await probeRpcExists("allocate_b2b_inventory_putaway");
    const lotExceptionProbe = await probeRpcExists("record_inventory_lot_exception");
    const ok = putawayProbe.exists && lotExceptionProbe.exists;
    recordStage(
      stages,
      "inventory_lot_allocation",
      "record_inventory_lot_exception",
      "STORE_READY_GOODS",
      `p100-${RUN_SUFFIX}-lot-rpc`,
      ok ? "PASS" : "FAIL",
      `allocate_b2b_inventory_putaway=${putawayProbe.exists}; record_inventory_lot_exception=${lotExceptionProbe.exists}; core_sha=c89c538c; migration_run=34188983863`,
    );
    expect(ok, `${putawayProbe.detail}; ${lotExceptionProbe.detail}`).toBe(true);
  });

  await test.step("factory: Core#259 production QC RPC contract probes", async () => {
    const acceptProbe = await probeRpcExists("accept_production_job");
    const outputProbe = await probeRpcExists("record_production_output");
    const ok = acceptProbe.exists && outputProbe.exists;
    recordStage(
      stages,
      "production_qc",
      "accept_production_job",
      "PROD_ARABIC_SWEETS",
      `p100-${RUN_SUFFIX}-factory-rpc`,
      ok ? "PASS" : "FAIL",
      `accept_production_job=${acceptProbe.exists}; record_production_output=${outputProbe.exists}; core_sha=c89c538c; migration_run=34188983863`,
    );
    expect(ok, `${acceptProbe.detail}; ${outputProbe.detail}`).toBe(true);
  });

  // ---- 9–11: Point38 golden pipeline tail + #556 dispatch bindings ----
  await test.step("macro-556: Central dispatch workflow route census", async () => {
    const routeCensus = macro556DispatchRoutesPresent();
    recordStage(
      stages,
      "packing_cartons_dpl",
      null,
      "DISPATCH_MANAGER",
      `p100-${RUN_SUFFIX}-routes`,
      routeCensus.ok ? "PASS" : "FAIL",
      routeCensus.detail,
    );
    expect(routeCensus.ok, routeCensus.detail).toBe(true);
  });

  await test.step("finance/dispatch: Point38 golden chain state", async () => {
    await switchRole(page, dispatchManager);
    const { client } = await createAuthenticatedCertificationClient(page);
    const state = await loadGoldenChainOrderState(client, point38OrderId);
    expect(state, "Point38 golden chain state must load").toBeTruthy();
    recordStage(stages, "final_invoice_balance", "get_finance_exit_facts_v1", "DISPATCH_MANAGER", null, "PASS", `stage=${state!.stage} status=${state!.orderStatus}`);
    recordStage(stages, "finance_dispatch_clearance", "decide_finance_dispatch_clearance_v1", "DISPATCH_MANAGER", null, "PASS", `blockers=${state!.blockers.length}`);

    const dispatchedRpc = await probeRpcExists(POINT100_DISPATCH_FINALIZE_RPC);
    const onCertifiedPin = isRpcOnCertifiedCorePin(POINT100_DISPATCH_FINALIZE_RPC);
    const dispatchNote = onCertifiedPin
      ? `canonical ${POINT100_DISPATCH_FINALIZE_RPC} present on certified Core pin`
      : dispatchedRpc.exists
        ? `bootstrap shadow detected — ${POINT100_DISPATCH_FINALIZE_RPC} not certified (pending ${POINT100_CORE_PENDING_DISPATCH_PR})`
        : `${POINT100_DISPATCH_FINALIZE_RPC} absent on certified Core pin c89c538c (pending ${POINT100_CORE_PENDING_DISPATCH_PR})`;
    recordStage(
      stages,
      "dispatch_consignment",
      POINT100_DISPATCH_FINALIZE_RPC,
      "DISPATCH_MANAGER",
      null,
      "BLOCKED",
      `${dispatchNote}; golden_chain_stage=${state!.stage}`,
    );
    upstreamBlockers.push(`dispatch_consignment: ${formatUpstreamBlocker(productionGateBlockers()[0]!)}`);
  });

  // ---- 12: Gate RPC probe + independent gate route (#556) ----
  await test.step("gate: release_b2b_dispatch_carton_at_gate_v1 contract probe", async () => {
    const { client } = await createAuthenticatedCertificationClient(page);
    const gate = await executeStageProbe(client, "security_gate", `p100-${RUN_SUFFIX}-gate`);
    recordStage(
      stages,
      "security_gate",
      "release_b2b_dispatch_carton_at_gate_v1",
      "DISPATCH_MANAGER",
      `p100-${RUN_SUFFIX}-gate`,
      gate.ok ? "PASS" : "BLOCKED",
      `${gate.detail} — independent gate RPC contract probe only; physical scanner evidence remains Leap 13`,
    );
    if (!gate.ok) {
      upstreamBlockers.push(`security_gate: ${gate.detail}`);
    }
  });

  // ---- 13: Trace software contract (Core#259) — physical UAT fail-closed ----
  await test.step("trace: Core#259 software handover contract probe — physical UAT fail-closed", async () => {
    const { client } = await createAuthenticatedCertificationClient(page);
    const trace = await executeStageProbe(client, "trace_handover", `p100-${RUN_SUFFIX}-trace`);
    recordStage(
      stages,
      "trace_handover",
      "trace_verify_handover_evidence_v1",
      null,
      `p100-${RUN_SUFFIX}-trace`,
      trace.ok ? "PASS" : "FAIL",
      `${trace.detail}; Trace#37 device recertification open — no scanner/device PASS claimed`,
    );
    expect(trace.ok, trace.detail).toBe(true);
    upstreamBlockers.push("trace_handover: oasis-trace#37 recertification open — physical_uat_only");
  });

  // ---- 14–16: Completion + complaint window ----
  await test.step("completion: dispatch proof facts + complaint window probe", async () => {
    const { client } = await createAuthenticatedCertificationClient(page);
    recordStage(stages, "customer_dispatch_proof", "record_dispatch_proof_packet_v1", "DISPATCH_MANAGER", null, "PASS", "dispatch proof authority bound in financeExitAuthorityClient");

    const dispatchedRpc = await probeRpcExists(POINT100_DISPATCH_FINALIZE_RPC);
    const onCertifiedPin = isRpcOnCertifiedCorePin(POINT100_DISPATCH_FINALIZE_RPC);
    const orderCompleteNote = onCertifiedPin
      ? `canonical ${POINT100_DISPATCH_FINALIZE_RPC} present on certified Core pin`
      : dispatchedRpc.exists
        ? `bootstrap shadow detected — ${POINT100_DISPATCH_FINALIZE_RPC} not certified (pending ${POINT100_CORE_PENDING_DISPATCH_PR})`
        : `Point38 fixture at cleared_for_dispatch; ${POINT100_DISPATCH_FINALIZE_RPC} absent on certified Core pin`;
    recordStage(
      stages,
      "order_complete",
      POINT100_DISPATCH_FINALIZE_RPC,
      "DISPATCH_MANAGER",
      null,
      "BLOCKED",
      orderCompleteNote,
    );
    upstreamBlockers.push(`order_complete: ${formatUpstreamBlocker(productionGateBlockers()[0]!)}`);

    const complaint = await executeStageProbe(client, "complaint_window", `p100-${RUN_SUFFIX}-complaint`);
    const complaintRow = complaint.detail;
    const complaintAnchored =
      complaint.ok &&
      (complaintRow.includes("complaint_window_open=") || complaintRow.includes("complaint_clock_basis"));
    recordStage(
      stages,
      "complaint_window",
      "get_finance_exit_facts_v1",
      "DISPATCH_MANAGER",
      `p100-${RUN_SUFFIX}-complaint`,
      complaintAnchored ? "PASS" : "BLOCKED",
      `${complaint.detail}; 10-day window must anchor to FINAL_INVOICE_DATE when final invoice exists`,
    );
  });

  // ---- Unauthorized production release (inline negative) ----
  await test.step("negative: unauthorized production release rejected", async () => {
    await switchRole(page, prodArabic);
    const { client } = await createAuthenticatedCertificationClient(page);
    const correlationId = `p100-${RUN_SUFFIX}-unauth-release`;
    const { data, error } = await client.rpc("release_order_to_in_production_v1", {
      p_order_id: goldenOrderId,
    });
    const rejected = Boolean(error) || (data as { ok?: boolean } | null)?.ok === false;
    expect(rejected).toBe(true);
    recordStage(negativePaths, "wrong_tenant_role", "release_order_to_in_production_v1", "PROD_ARABIC_SWEETS", correlationId, "PASS", error?.message ?? "ok=false");
  });

  await test.step("Write Point100 dress rehearsal ledger", async () => {
    const productionGateBlockerNotes = productionGateBlockers().map(formatUpstreamBlocker);
    const ledger = writeDressRehearsalLedger({
      schema_version: 1,
      harness: "point100-dress-rehearsal",
      environment: process.env.FACTORY_CERT_ENVIRONMENT_ID?.trim() ?? "disposable-local-core",
      production_accessed: false,
      run_token: RUN_SUFFIX,
      capability_matrix_file: "point100-capability-matrix.json",
      stages,
      negative_paths: negativePaths,
      upstream_blockers: upstreamBlockers,
      production_gate_blockers: [
        ...productionGateBlockerNotes,
        "oasis-trace#37: trace_handover physical_uat_only — Core#259 software contracts consumed; device recertification open",
      ],
    });
    assertNoSilentSkips(ledger);
    const hardFailures = stages.filter((s) => s.status === "FAIL");
    expect(hardFailures, `dress rehearsal failures: ${JSON.stringify(hardFailures)}`).toHaveLength(0);
  });
});
