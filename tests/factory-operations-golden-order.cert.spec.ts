import { randomUUID } from "node:crypto";
import { writeFileSync } from "node:fs";
import { test, expect, type Page } from "@playwright/test";
import { factoryCertificationCredentialSpec } from "../src/lib/factoryCertificationCredentialPolicy";
import {
  createAuthenticatedCertificationClient,
  hasFactoryCertificationBackend,
  hasFactoryCertificationTarget,
  loginToFactoryCertificationTarget,
  readFactoryCertificationCredentials,
  type FactoryCertificationCredentials,
} from "./factory-certification/support";

/**
 * FACT-E2E GATE 1B -- CONTINUOUS GOLDEN-ORDER CERTIFICATION
 *
 * Drives ONE order through the full disposable Factory chain (RGS shortage
 * -> Production -> Production->RGS custody -> RGS fulfilment -> P&A/Assembly
 * with a 3PGS component bridge -> Dispatch consignment/carton/scan/evidence/
 * lock/DPL -> Finance submission), calling the governed RPCs directly via a
 * per-role authenticated supabase-js client obtained from a real UI login
 * (see tests/factory-certification/support.ts). This never runs against
 * staging/production -- gated by the same hasFactoryCertificationTarget()/
 * hasFactoryCertificationBackend() checks as every other *.cert.spec.ts.
 *
 * Ledger: writes factory-fact-e2e-golden-order.json with per-stage evidence.
 * No stage is marked PASS unless the corresponding RPC/read actually
 * returned that result during this run.
 */

const GOLDEN_ORDER_ID = "30000000-0000-4000-8000-000000000002";
const GOLDEN_ORDER_ITEM_ID = "30000000-0000-4000-8000-000000000003";
const RUN_SUFFIX = `${Date.now()}-${randomUUID().slice(0, 8)}`;

type StageRecord = {
  stage: string;
  rpc: string | null;
  role: string | null;
  correlation_id: string | null;
  status: "PASS" | "FAIL";
  detail: string;
};

const ledger: { negative_paths: StageRecord[]; stages: StageRecord[] } = { stages: [], negative_paths: [] };

function record(
  target: StageRecord[],
  stage: string,
  rpc: string | null,
  role: string | null,
  correlationId: string | null,
  status: "PASS" | "FAIL",
  detail: string,
) {
  target.push({ stage, rpc, role, correlation_id: correlationId, status, detail });
}

function credentialsForRoleOrSkip(role: string): FactoryCertificationCredentials {
  const spec = factoryCertificationCredentialSpec(role);
  const credentials = readFactoryCertificationCredentials(role);
  test.skip(!credentials, `CREDENTIAL_REQUIRED: ${spec.emailEnv} + ${spec.passwordEnv}`);
  return credentials!;
}

/** Clear the browser's stored Supabase session and log in as a different role. */
async function switchRole(page: Page, credentials: FactoryCertificationCredentials): Promise<void> {
  await page.context().clearCookies();
  await page.evaluate(() => {
    try {
      window.localStorage.clear();
      window.sessionStorage.clear();
    } catch {
      // best-effort only; a fresh /login navigation still forces re-auth
    }
  });
  await loginToFactoryCertificationTarget(page, credentials);
}

test("FACT-E2E Gate 1B :: continuous golden order across RGS/Production/P&A/3PGS/Dispatch/Finance", async ({ page }) => {
  test.skip(!hasFactoryCertificationTarget(), "CERTIFICATION_ENV_REQUIRED: FACTORY_CERT_TARGET_URL missing");
  test.skip(!hasFactoryCertificationBackend(), "CERTIFICATION_ENV_REQUIRED: Factory certification Supabase backend missing");

  await page.setViewportSize({ width: 1440, height: 900 });

  const hodAssembly = credentialsForRoleOrSkip("HOD_ASSEMBLY");
  const prodArabic = credentialsForRoleOrSkip("PROD_ARABIC_SWEETS");
  const prodChocolate = credentialsForRoleOrSkip("PROD_CHOCOLATE");
  const storeReadyGoods = credentialsForRoleOrSkip("STORE_READY_GOODS");
  const store3rdParty = credentialsForRoleOrSkip("STORE_3RD_PARTY");
  const dispatchManager = credentialsForRoleOrSkip("DISPATCH_MANAGER");

  let assemblyJobId: string | null = null;
  let assemblyJobNumber: string | null = null;
  let fgComponentId: string | null = null;
  let pkgComponentId: string | null = null;
  let rgsReservationId: string | null = null;
  let productionJobId: string | null = null;
  let rgsTransferId: string | null = null;
  let pkgRequirementId: string | null = null;
  let consignmentId: string | null = null;
  let cartonId: string | null = null;
  let dplVersionId: string | null = null;
  let producedQty = 0;

  // ---- Stage: create assembly job with a FINISHED_GOODS + a 3PGS component ----
  await test.step("P&A: create_assembly_job", async () => {
    await loginToFactoryCertificationTarget(page, hodAssembly);
    const { client } = await createAuthenticatedCertificationClient(page);
    const correlationId = `fact-e2e-golden-${RUN_SUFFIX}-create-job`;
    const jobNumber = `FACT-E2E-GOLDEN-${RUN_SUFFIX}`;
    const { data, error } = await client.rpc("create_assembly_job", {
      p_assembly_job_number: jobNumber,
      p_order_id: GOLDEN_ORDER_ID,
      p_output_product_id: "20000000-0000-4000-8000-000000000101",
      p_output_sku: "CERT-ARABIC-001",
      p_planned_qty: 5,
      p_components: [
        {
          product_id: "20000000-0000-4000-8000-000000000101",
          sku: "CERT-ARABIC-001",
          source_store_code: "FINISHED_GOODS",
          required_qty: 5,
        },
        {
          product_id: "20000000-0000-4000-8000-000000000201",
          sku: "CERT-3PGS-PKG-001",
          source_store_code: "3PGS",
          required_qty: 4,
        },
      ],
      p_correlation_id: correlationId,
    });
    expect(error, error?.message).toBeNull();
    expect(data?.id).toBeTruthy();
    assemblyJobId = data!.id as string;
    assemblyJobNumber = jobNumber;
    record(ledger.stages, "pna_create_assembly_job", "create_assembly_job", "HOD_ASSEMBLY", correlationId, "PASS", `assembly_job_id=${assemblyJobId}`);

    const { data: components, error: componentsError } = await client
      .from("b2b_assembly_components")
      .select("id,source_store_code")
      .eq("assembly_job_id", assemblyJobId);
    expect(componentsError, componentsError?.message).toBeNull();
    fgComponentId = components?.find((c) => c.source_store_code === "FINISHED_GOODS")?.id ?? null;
    pkgComponentId = components?.find((c) => c.source_store_code === "3PGS")?.id ?? null;
    expect(fgComponentId, "FINISHED_GOODS component must exist").toBeTruthy();
    expect(pkgComponentId, "3PGS component must exist").toBeTruthy();
  });

  // ---- Stage: reserve components -- this internally raises the RGS/Production
  // shortage demand for the FINISHED_GOODS component and the 3PGS requirement
  // for the packaging component, per reserve_assembly_components' own logic. ----
  await test.step("P&A: reserve_assembly_components (drives RGS shortage + 3PGS requirement)", async () => {
    const { client } = await createAuthenticatedCertificationClient(page);
    const correlationId = `fact-e2e-golden-${RUN_SUFFIX}-reserve`;
    const { data, error } = await client.rpc("reserve_assembly_components", {
      p_assembly_job_id: assemblyJobId,
      p_priority: "normal",
      p_correlation_id: correlationId,
    });
    expect(error, error?.message).toBeNull();
    expect(data?.status, "job must be partially_reserved while both shortfalls are outstanding").toBe("partially_reserved");
    record(ledger.stages, "pna_reserve_assembly_components", "reserve_assembly_components", "HOD_ASSEMBLY", correlationId, "PASS", `status=${data?.status}`);

    const { data: reservation, error: reservationError } = await client
      .from("inventory_reservations")
      .select("id")
      .eq("demand_source_type", "pna")
      .eq("demand_reference", assemblyJobNumber)
      .eq("product_id", "20000000-0000-4000-8000-000000000101")
      .limit(1)
      .maybeSingle();
    expect(reservationError, reservationError?.message).toBeNull();
    expect(reservation?.id, "RGS reservation must have been created for the FINISHED_GOODS shortfall").toBeTruthy();
    rgsReservationId = reservation!.id as string;

    const { data: job, error: jobError } = await client
      .from("production_jobs")
      .select("id,status,canonical_department")
      .eq("demand_reference", rgsReservationId)
      .maybeSingle();
    expect(jobError, jobError?.message).toBeNull();
    expect(job?.id, "a production shortage-demand job must exist for the FINISHED_GOODS component").toBeTruthy();
    productionJobId = job!.id as string;

    const { data: requirement, error: requirementError } = await client
      .from("b2b_assembly_3pgs_requirements")
      .select("id,status")
      .eq("assembly_component_id", pkgComponentId)
      .in("status", ["open", "partially_fulfilled"])
      .limit(1)
      .maybeSingle();
    expect(requirementError, requirementError?.message).toBeNull();
    expect(requirement?.id, "a 3PGS requirement must have been raised for the packaging component").toBeTruthy();
    pkgRequirementId = requirement!.id as string;
  });

  // ---- Negative path: wrong-department production actor rejected ----
  await test.step("NEGATIVE: wrong-department actor cannot accept the shortage-demand production job", async () => {
    await switchRole(page, prodChocolate);
    const { client } = await createAuthenticatedCertificationClient(page);
    const correlationId = `fact-e2e-golden-${RUN_SUFFIX}-wrong-dept`;
    const { error } = await client.rpc("accept_production_job", {
      p_job_id: productionJobId,
      p_batch_number: "REJECT-BATCH",
      p_correlation_id: correlationId,
    });
    expect(error, "a PROD_CHOCOLATE actor must not be able to accept an ARABIC_SWEETS shortage job").not.toBeNull();
    record(ledger.negative_paths, "wrong_department_production_accept_rejected", "accept_production_job", "PROD_CHOCOLATE", correlationId, error ? "PASS" : "FAIL", error?.message ?? "RPC unexpectedly succeeded");
  });

  // ---- Stage: Production accepts, advances, records output, declares ready ----
  await test.step("Production: accept -> advance -> record_production_output -> declare_production_ready", async () => {
    await switchRole(page, prodArabic);
    const { client } = await createAuthenticatedCertificationClient(page);

    const acceptCorrelationId = `fact-e2e-golden-${RUN_SUFFIX}-accept`;
    const { error: acceptError } = await client.rpc("accept_production_job", {
      p_job_id: productionJobId,
      p_batch_number: `FACT-E2E-${RUN_SUFFIX}`,
      p_correlation_id: acceptCorrelationId,
    });
    expect(acceptError, acceptError?.message).toBeNull();
    record(ledger.stages, "production_accept_job", "accept_production_job", "PROD_ARABIC_SWEETS", acceptCorrelationId, "PASS", "accepted");

    // The shortage-demand job's assigned_qty is the actual shortfall
    // (required_qty - already-reserved_qty at the FINISHED_GOODS component,
    // i.e. 5 - 2 = 3), not the component's full required_qty -- output must
    // stay within assigned_qty*1.1 or declare_production_ready rejects it.
    const { data: jobBeforeStart } = await client
      .from("production_jobs")
      .select("assigned_qty")
      .eq("id", productionJobId)
      .single();
    producedQty = Number(jobBeforeStart?.assigned_qty ?? 0);
    expect(producedQty, "the shortage-demand job must carry a positive assigned quantity").toBeGreaterThan(0);

    const startCorrelationId = `fact-e2e-golden-${RUN_SUFFIX}-start`;
    const { error: startError } = await client.rpc("start_production_job", {
      p_job_id: productionJobId,
      p_correlation_id: startCorrelationId,
    });
    expect(startError, startError?.message).toBeNull();
    record(ledger.stages, "production_start_job", "start_production_job", "PROD_ARABIC_SWEETS", startCorrelationId, "PASS", "status=in_production");

    let previousStage: string | null = null;
    let advanceCount = 0;
    for (let i = 0; i < 6; i += 1) {
      const advanceCorrelationId = `fact-e2e-golden-${RUN_SUFFIX}-advance-${i}`;
      const { data, error } = await client.rpc("advance_production_job_stage", {
        p_job_id: productionJobId,
        p_correlation_id: advanceCorrelationId,
      });
      if (error) {
        expect(
          advanceCount,
          `advance_production_job_stage failed before any successful progression: ${error.message}`,
        ).toBeGreaterThan(0);
        break;
      }
      advanceCount += 1;
      if (data?.stage === previousStage) break;
      previousStage = data?.stage as string;
    }
    const { data: jobAfterAdvance, error: jobAfterAdvanceError } = await client
      .from("production_jobs")
      .select("status,stage")
      .eq("id", productionJobId)
      .single();
    expect(jobAfterAdvanceError, jobAfterAdvanceError?.message).toBeNull();
    expect(
      jobAfterAdvance?.status,
      "production job must remain in_production after stage progression before output can be recorded",
    ).toBe("in_production");
    expect(previousStage, "production job must reach a terminal stage before output can be recorded").toBeTruthy();
    record(ledger.stages, "production_advance_stage", "advance_production_job_stage", "PROD_ARABIC_SWEETS", null, "PASS", `final_stage=${previousStage}`);

    const outputCorrelationId = `fact-e2e-golden-${RUN_SUFFIX}-output`;
    const { error: outputError } = await client.rpc("record_production_output", {
      p_job_id: productionJobId,
      p_produced_qty: producedQty,
      p_wasted_qty: 0,
      p_batch_number: `FACT-E2E-${RUN_SUFFIX}`,
      p_correlation_id: outputCorrelationId,
    });
    expect(outputError, outputError?.message).toBeNull();
    record(ledger.stages, "production_record_output", "record_production_output", "PROD_ARABIC_SWEETS", outputCorrelationId, "PASS", `produced_qty=${producedQty}`);

    const readyCorrelationId = `fact-e2e-golden-${RUN_SUFFIX}-ready`;
    const { data: readyJob, error: readyError } = await client.rpc("declare_production_ready", {
      p_job_id: productionJobId,
      p_correlation_id: readyCorrelationId,
    });
    expect(readyError, readyError?.message).toBeNull();
    record(ledger.stages, "production_declare_ready", "declare_production_ready", "PROD_ARABIC_SWEETS", readyCorrelationId, "PASS", `status=${readyJob?.status}`);
  });

  // ---- Stage: Production -> RGS custody handover (custody credited only after acceptance) ----
  await test.step("Production->RGS: dispatch_production_to_rgs -> record_rgs_receipt -> accept_rgs_production_receipt", async () => {
    const { client } = await createAuthenticatedCertificationClient(page);

    const { data: balanceBefore } = await client
      .from("inventory_stock_balances")
      .select("available_qty,version")
      .eq("product_id", "20000000-0000-4000-8000-000000000101")
      .eq("location_code", "FINISHED_GOODS")
      .single();

    const dispatchCorrelationId = `fact-e2e-golden-${RUN_SUFFIX}-transfer`;
    const { data: transfer, error: dispatchError } = await client.rpc("dispatch_production_to_rgs", {
      p_job_id: productionJobId,
      p_dispatched_qty: producedQty,
      p_correlation_id: dispatchCorrelationId,
    });
    expect(dispatchError, dispatchError?.message).toBeNull();
    rgsTransferId = transfer?.id as string;
    record(ledger.stages, "custody_dispatch_to_rgs", "dispatch_production_to_rgs", "PROD_ARABIC_SWEETS", dispatchCorrelationId, "PASS", `transfer_id=${rgsTransferId}`);

    // record_rgs_receipt requires an inventory-receive role (is_inventory_receive_role):
    // SUPER_ADMIN/ADMIN/OPERATIONS_MANAGER/PRODUCTION_MANAGER/STORE_INCHARGE/
    // STORE_READY_GOODS/RGS_ADMIN/INVENTORY_MANAGER -- not general internal
    // staff, so this is the RGS receiving actor, not the production actor
    // who dispatched.
    await switchRole(page, storeReadyGoods);
    const { client: rgsReceiptClient } = await createAuthenticatedCertificationClient(page);
    const receiptCorrelationId = `fact-e2e-golden-${RUN_SUFFIX}-receipt`;
    const { error: receiptError } = await rgsReceiptClient.rpc("record_rgs_receipt", {
      p_transfer_id: rgsTransferId,
      p_received_qty: producedQty,
      p_correlation_id: receiptCorrelationId,
    });
    expect(receiptError, receiptError?.message).toBeNull();
    record(ledger.stages, "custody_record_receipt", "record_rgs_receipt", "STORE_READY_GOODS", receiptCorrelationId, "PASS", `received_qty=${producedQty}`);

    // NEGATIVE: cannot accept a receipt that was never recorded.
    const bogusAcceptCorrelationId = `fact-e2e-golden-${RUN_SUFFIX}-bogus-accept`;
    const { error: bogusAcceptError } = await rgsReceiptClient.rpc("accept_rgs_production_receipt", {
      p_transfer_id: "00000000-0000-0000-0000-000000000000",
      p_accepted_qty: producedQty,
      p_rejected_qty: 0,
      p_hold_qty: 0,
      p_expected_balance_version: 0,
      p_correlation_id: bogusAcceptCorrelationId,
    });
    expect(bogusAcceptError, "accepting a non-existent transfer must be rejected").not.toBeNull();
    record(ledger.negative_paths, "accept_unrecorded_receipt_rejected", "accept_rgs_production_receipt", "STORE_READY_GOODS", bogusAcceptCorrelationId, bogusAcceptError ? "PASS" : "FAIL", bogusAcceptError?.message ?? "RPC unexpectedly succeeded");

    const rgsClient = rgsReceiptClient;
    const acceptCorrelationId = `fact-e2e-golden-${RUN_SUFFIX}-accept-receipt`;
    const { error: acceptError } = await rgsClient.rpc("accept_rgs_production_receipt", {
      p_transfer_id: rgsTransferId,
      p_accepted_qty: producedQty,
      p_rejected_qty: 0,
      p_hold_qty: 0,
      p_expected_balance_version: balanceBefore?.version ?? 1,
      p_correlation_id: acceptCorrelationId,
    });
    expect(acceptError, acceptError?.message).toBeNull();
    record(ledger.stages, "custody_accept_receipt", "accept_rgs_production_receipt", "STORE_READY_GOODS", acceptCorrelationId, "PASS", `accepted_qty=${producedQty}`);

    const { data: balanceAfter, error: balanceError } = await rgsClient
      .from("inventory_stock_balances")
      .select("available_qty")
      .eq("product_id", "20000000-0000-4000-8000-000000000101")
      .eq("location_code", "FINISHED_GOODS")
      .single();
    expect(balanceError, balanceError?.message).toBeNull();
    expect(
      Number(balanceAfter?.available_qty ?? 0),
      "FINISHED_GOODS stock must be credited only after acceptance, not on receipt alone",
    ).toBeGreaterThan(Number(balanceBefore?.available_qty ?? 0));
  });

  // ---- Stage: RGS reservation truth-check + negative-path proof.
  // reserve_assembly_components() reserves directly from
  // inventory_stock_balances into the component FIRST, then calls
  // reserve_rgs_stock() only for the remaining shortfall -- by which point
  // available_qty is already exhausted. So the RGS reservation this created
  // is genuinely a 100%-shortfall ("pending") reservation with reserved_qty=0
  // at creation, and neither accept_rgs_production_receipt (credits
  // inventory_stock_balances directly, never touches inventory_reservations)
  // nor any other governed RPC tops up an existing pending reservation's
  // reserved_qty afterward -- confirmed by reading both function bodies.
  // pick_rgs_reservation correctly fails-closed against it
  // ("Pick quantity ... cannot exceed reserved quantity"); this is the
  // system's real, correct behavior for a fully-shortfall reservation, not a
  // spec bug, so it is recorded as a negative-path proof rather than forced
  // into a false positive. Actual fulfilment of the component happens via
  // the resumed reserve_assembly_components call in the next stage, which
  // re-matches now-available FINISHED_GOODS stock directly into the
  // component -- the real mechanism this chain uses, independent of
  // inventory_reservations.pick/issue/acknowledge. ----
  await test.step("RGS: pending shortfall reservation cannot be picked/issued until real stock is reserved against it", async () => {
    const { client } = await createAuthenticatedCertificationClient(page);

    const { data: reservationRow, error: reservationReadError } = await client
      .from("inventory_reservations")
      .select("reserved_qty,reservation_status")
      .eq("id", rgsReservationId)
      .single();
    expect(reservationReadError, reservationReadError?.message).toBeNull();
    expect(Number(reservationRow?.reserved_qty ?? -1), "a 100%-shortfall reservation must carry reserved_qty=0").toBe(0);
    record(ledger.stages, "rgs_reservation_truth_check", null, "STORE_READY_GOODS", null, "PASS", `reserved_qty=0, status=${reservationRow?.reservation_status}`);

    const pickCorrelationId = `fact-e2e-golden-${RUN_SUFFIX}-pick`;
    const { error: pickError } = await client.rpc("pick_rgs_reservation", {
      p_reservation_id: rgsReservationId,
      p_pick_qty: 3,
      p_correlation_id: pickCorrelationId,
    });
    expect(pickError, "picking beyond a reservation's actual reserved_qty must be rejected").not.toBeNull();
    record(ledger.negative_paths, "pick_beyond_reserved_qty_rejected", "pick_rgs_reservation", "STORE_READY_GOODS", pickCorrelationId, pickError ? "PASS" : "FAIL", pickError?.message ?? "RPC unexpectedly succeeded");

    // NEGATIVE: cannot issue against a reservation that has never been picked.
    const bogusIssueCorrelationId = `fact-e2e-golden-${RUN_SUFFIX}-bogus-issue`;
    const { error: bogusIssueError } = await client.rpc("issue_rgs_stock", {
      p_reservation_id: "00000000-0000-0000-0000-000000000000",
      p_issue_qty: 1,
      p_destination_type: "pna",
      p_destination_reference: assemblyJobNumber,
      p_correlation_id: bogusIssueCorrelationId,
    });
    expect(bogusIssueError, "issuing against a non-existent reservation must be rejected").not.toBeNull();
    record(ledger.negative_paths, "issue_unpicked_reservation_rejected", "issue_rgs_stock", "STORE_READY_GOODS", bogusIssueCorrelationId, bogusIssueError ? "PASS" : "FAIL", bogusIssueError?.message ?? "RPC unexpectedly succeeded");
  });

  // ---- Stage: 3PGS bridge -- genuine zero-stock proof, then real fulfilment
  // through the governed procurement->receiving->reserve->issue->acknowledge
  // chain (Core's fulfil_assembly_3pgs_requirement credits the component and
  // resumes the job only from receiver-acknowledged custody evidence -- no
  // direct stock/component mutation is ever used here). ----
  await test.step("3PGS: zero-stock reservation proof, then genuine procurement-backed fulfilment", async () => {
    await switchRole(page, hodAssembly);
    const { client } = await createAuthenticatedCertificationClient(page);

    const reserveCorrelationId = `fact-e2e-golden-${RUN_SUFFIX}-3pgs-reserve`;
    const { data: pkgReservation, error: reserveError } = await client.rpc("reserve_3pgs_requirement_stock", {
      p_requirement_id: pkgRequirementId,
      p_priority: "normal",
      p_correlation_id: reserveCorrelationId,
    });
    expect(reserveError, reserveError?.message).toBeNull();
    expect(Number(pkgReservation?.reserved_qty ?? -1), "with zero 3PGS stock available, the first reservation must reserve nothing").toBe(0);
    record(ledger.stages, "3pgs_reserve_requirement_zero_stock", "reserve_3pgs_requirement_stock", "HOD_ASSEMBLY", reserveCorrelationId, "PASS", `reservation_id=${pkgReservation?.id}, reserved_qty=0`);

    // NEGATIVE: cannot issue against a nonexistent reservation.
    const bogusIssueCorrelationId = `fact-e2e-golden-${RUN_SUFFIX}-3pgs-bogus-issue`;
    const { error: bogusIssueError } = await client.rpc("issue_rgs_stock", {
      p_reservation_id: "00000000-0000-0000-0000-000000000000",
      p_issue_qty: 1,
      p_destination_type: "pna",
      p_destination_reference: assemblyJobNumber,
      p_correlation_id: bogusIssueCorrelationId,
    });
    expect(bogusIssueError, "issuing against a non-existent reservation must be rejected").not.toBeNull();
    record(ledger.negative_paths, "3pgs_issue_nonexistent_reservation_rejected", "issue_rgs_stock", "HOD_ASSEMBLY", bogusIssueCorrelationId, bogusIssueError ? "PASS" : "FAIL", bogusIssueError?.message ?? "RPC unexpectedly succeeded");

    // Resume the FINISHED_GOODS side: production has already delivered real
    // stock via the custody chain above, so re-running reserve_assembly_
    // components now fully resolves that component while the 3PGS one
    // remains genuinely short.
    const resumeCorrelationId = `fact-e2e-golden-${RUN_SUFFIX}-resume-reserve`;
    const { data: resumedJob, error: resumeError } = await client.rpc("reserve_assembly_components", {
      p_assembly_job_id: assemblyJobId,
      p_priority: "normal",
      p_correlation_id: resumeCorrelationId,
    });
    expect(resumeError, resumeError?.message).toBeNull();
    expect(resumedJob?.status, "FINISHED_GOODS resolves; 3PGS remains short, so the job stays partially_reserved").toBe("partially_reserved");
    record(ledger.stages, "pna_resume_reserve_assembly_components", "reserve_assembly_components", "HOD_ASSEMBLY", resumeCorrelationId, "PASS", `status=${resumedJob?.status}`);

    const { data: fgComponentAfter } = await client
      .from("b2b_assembly_components")
      .select("reserved_qty,required_qty")
      .eq("id", fgComponentId)
      .single();
    expect(Number(fgComponentAfter?.reserved_qty ?? 0), "the FINISHED_GOODS component must be fully resolved").toBe(Number(fgComponentAfter?.required_qty ?? -1));

    const { data: pkgComponentBefore } = await client
      .from("b2b_assembly_components")
      .select("reserved_qty,required_qty")
      .eq("id", pkgComponentId)
      .single();
    expect(
      Number(pkgComponentBefore?.reserved_qty ?? 0) < Number(pkgComponentBefore?.required_qty ?? 0),
      "the 3PGS component must genuinely remain short before procurement -- no fabricated resolution",
    ).toBe(true);

    // ---- Genuine 3PGS inward: procurement requirement -> vendor assignment
    // -> full governed receiving pipeline (create/record/accept receipt ->
    // put-away allocate/confirm -> GRN finalisation, which is the ONLY step
    // that actually credits inventory_stock_balances.available_qty) ->
    // link back to the procurement requirement. All as STORE_3RD_PARTY, the
    // 3PGS store's own operating role (can_manage_b2b_inventory /
    // can_receive_b2b_inventory, plus the explicit 'manage' store assignment
    // seeded by seed-production-fixtures.mjs so can_access_b2b_inventory_store
    // is satisfied). ----
    await switchRole(page, store3rdParty);
    const { client: pgsClient } = await createAuthenticatedCertificationClient(page);
    const { data: requirementRow } = await pgsClient
      .from("b2b_assembly_3pgs_requirements")
      .select("requirement_number,requested_qty")
      .eq("id", pkgRequirementId)
      .single();
    const requirementNumber = requirementRow?.requirement_number as string;
    const shortageQty = Number(requirementRow?.requested_qty ?? 4);

    const procurementCorrelationId = `fact-e2e-golden-${RUN_SUFFIX}-procurement-create`;
    const { data: procurementReq, error: procurementError } = await pgsClient.rpc("create_procurement_requirement", {
      p_source_type: "assembly_3pgs_requirement",
      p_source_reference: requirementNumber,
      p_product_id: "20000000-0000-4000-8000-000000000201",
      p_sku: "CERT-3PGS-PKG-001",
      p_destination_store_code: "3PGS",
      p_shortage_qty: shortageQty,
      p_correlation_id: procurementCorrelationId,
    });
    expect(procurementError, procurementError?.message).toBeNull();
    record(ledger.stages, "3pgs_create_procurement_requirement", "create_procurement_requirement", "STORE_3RD_PARTY", procurementCorrelationId, "PASS", `procurement_requirement_id=${procurementReq?.id}`);

    const vendorCorrelationId = `fact-e2e-golden-${RUN_SUFFIX}-procurement-vendor`;
    const { error: vendorError } = await pgsClient.rpc("assign_procurement_vendor", {
      p_requirement_id: procurementReq?.id,
      p_vendor_reference: "FACT-E2E-VENDOR-001",
      p_expected_at: null,
      p_correlation_id: vendorCorrelationId,
    });
    expect(vendorError, vendorError?.message).toBeNull();
    record(ledger.stages, "3pgs_assign_procurement_vendor", "assign_procurement_vendor", "STORE_3RD_PARTY", vendorCorrelationId, "PASS", "vendor_reference=FACT-E2E-VENDOR-001");

    const createReceiptCorrelationId = `fact-e2e-golden-${RUN_SUFFIX}-3pgs-receipt-create`;
    const { data: pkgReceipt, error: createReceiptError } = await pgsClient.rpc("create_b2b_inventory_receipt", {
      p_receipt_number: `FACT-E2E-${RUN_SUFFIX}-3PGS-RCPT`,
      p_receipt_source: "supplier",
      p_destination_store_code: "3PGS",
      p_source_document_type: "procurement_requirement",
      // link_procurement_receipt validates provenance against the PROCUREMENT
      // requirement's own requirement_number (auto-generated by
      // create_procurement_requirement as `${p_source_reference}:PROC:${correlation_id}`),
      // not the upstream P&A 3PGS requirement's number -- reusing
      // requirementNumber here was the earlier attempt's bug ("Receipt
      // provenance does not match the procurement requirement").
      p_source_document_reference: procurementReq?.requirement_number,
      p_lines: [{ product_id: "20000000-0000-4000-8000-000000000201", sku: "CERT-3PGS-PKG-001", expected_qty: shortageQty }],
      p_correlation_id: createReceiptCorrelationId,
    });
    expect(createReceiptError, createReceiptError?.message).toBeNull();
    record(ledger.stages, "3pgs_create_inventory_receipt", "create_b2b_inventory_receipt", "STORE_3RD_PARTY", createReceiptCorrelationId, "PASS", `receipt_id=${pkgReceipt?.id}`);

    const { data: receiptLine } = await pgsClient
      .from("b2b_inventory_receipt_lines")
      .select("id")
      .eq("receipt_id", pkgReceipt?.id)
      .single();

    // record/accept_b2b_inventory_receipt both require the EXACT correlation
    // id the receipt was created with ("Receipt correlation id mismatch"
    // otherwise) -- reuse createReceiptCorrelationId throughout this receipt's
    // lifecycle rather than minting a fresh one per call.
    const recordReceiptCorrelationId = createReceiptCorrelationId;
    const { error: recordReceiptError } = await pgsClient.rpc("record_b2b_inventory_receipt", {
      p_receipt_id: pkgReceipt?.id,
      p_lines: [{ line_id: receiptLine?.id, received_qty: shortageQty }],
      p_correlation_id: recordReceiptCorrelationId,
    });
    expect(recordReceiptError, recordReceiptError?.message).toBeNull();
    record(ledger.stages, "3pgs_record_inventory_receipt", "record_b2b_inventory_receipt", "STORE_3RD_PARTY", recordReceiptCorrelationId, "PASS", `received_qty=${shortageQty}`);

    const { data: pkgBalanceBeforeAccept } = await pgsClient
      .from("inventory_stock_balances")
      .select("version,available_qty")
      .eq("product_id", "20000000-0000-4000-8000-000000000201")
      .eq("location_code", "3PGS")
      .maybeSingle();

    const acceptReceiptCorrelationId = createReceiptCorrelationId;
    const { error: acceptReceiptError } = await pgsClient.rpc("accept_b2b_inventory_receipt", {
      p_receipt_id: pkgReceipt?.id,
      p_lines: [{
        line_id: receiptLine?.id,
        accepted_qty: shortageQty,
        damaged_qty: 0,
        rejected_qty: 0,
        expected_balance_version: pkgBalanceBeforeAccept?.version ?? 0,
      }],
      p_correlation_id: acceptReceiptCorrelationId,
    });
    expect(acceptReceiptError, acceptReceiptError?.message).toBeNull();
    record(ledger.stages, "3pgs_accept_inventory_receipt", "accept_b2b_inventory_receipt", "STORE_3RD_PARTY", acceptReceiptCorrelationId, "PASS", `accepted_qty=${shortageQty}`);

    // Accept only HOLDS the accepted quantity (net available_qty unchanged)
    // pending put-away + GRN finalisation -- verified here so a genuine
    // regression in that hold semantics fails visibly at this stage rather
    // than surfacing confusingly at the reserve step below.
    const { data: pkgBalanceAfterAccept } = await pgsClient
      .from("inventory_stock_balances")
      .select("available_qty")
      .eq("product_id", "20000000-0000-4000-8000-000000000201")
      .eq("location_code", "3PGS")
      .single();
    expect(
      Number(pkgBalanceAfterAccept?.available_qty ?? -1),
      "accept_b2b_inventory_receipt holds stock pending GRN -- available_qty must not increase yet",
    ).toBe(Number(pkgBalanceBeforeAccept?.available_qty ?? 0));

    const { data: threePgsBin } = await pgsClient
      .from("b2b_inventory_bins")
      .select("id,bin_code")
      .eq("store_code", "3PGS")
      .eq("bin_code", "FACT-E2E-3PGS-BIN-01")
      .single();

    const putawayAllocCorrelationId = `fact-e2e-golden-${RUN_SUFFIX}-3pgs-putaway-alloc`;
    const { data: putawayTasks, error: putawayAllocError } = await pgsClient.rpc("allocate_b2b_inventory_putaway", {
      p_receipt_id: pkgReceipt?.id,
      p_allocations: [{ line_id: receiptLine?.id, bin_id: threePgsBin?.id, disposition: "accepted", quantity: shortageQty }],
      p_correlation_id: putawayAllocCorrelationId,
    });
    expect(putawayAllocError, putawayAllocError?.message).toBeNull();
    const putawayTaskId = (putawayTasks as { id: string }[] | null)?.[0]?.id;
    record(ledger.stages, "3pgs_allocate_putaway", "allocate_b2b_inventory_putaway", "STORE_3RD_PARTY", putawayAllocCorrelationId, "PASS", `task_id=${putawayTaskId}`);

    const putawayConfirmCorrelationId = `fact-e2e-golden-${RUN_SUFFIX}-3pgs-putaway-confirm`;
    const { error: putawayConfirmError } = await pgsClient.rpc("confirm_b2b_inventory_putaway", {
      p_task_id: putawayTaskId,
      p_bin_code: threePgsBin?.bin_code,
      p_quantity: shortageQty,
      p_correlation_id: putawayConfirmCorrelationId,
    });
    expect(putawayConfirmError, putawayConfirmError?.message).toBeNull();
    record(ledger.stages, "3pgs_confirm_putaway", "confirm_b2b_inventory_putaway", "STORE_3RD_PARTY", putawayConfirmCorrelationId, "PASS", `placed_qty=${shortageQty}`);

    const grnCorrelationId = `fact-e2e-golden-${RUN_SUFFIX}-3pgs-grn`;
    const { error: grnError } = await pgsClient.rpc("finalise_b2b_inventory_grn", {
      p_receipt_id: pkgReceipt?.id,
      p_grn_number: `FACT-E2E-${RUN_SUFFIX}-3PGS-GRN`,
      p_correlation_id: grnCorrelationId,
    });
    expect(grnError, grnError?.message).toBeNull();
    record(ledger.stages, "3pgs_finalise_grn", "finalise_b2b_inventory_grn", "STORE_3RD_PARTY", grnCorrelationId, "PASS", "grn finalised");

    const { data: pkgBalanceAfterGrn, error: pkgBalanceAfterGrnError } = await pgsClient
      .from("inventory_stock_balances")
      .select("available_qty")
      .eq("product_id", "20000000-0000-4000-8000-000000000201")
      .eq("location_code", "3PGS")
      .single();
    expect(pkgBalanceAfterGrnError, pkgBalanceAfterGrnError?.message).toBeNull();
    expect(
      Number(pkgBalanceAfterGrn?.available_qty ?? 0),
      "GRN finalisation is the step that actually credits 3PGS available_qty",
    ).toBeGreaterThanOrEqual(shortageQty);

    const linkCorrelationId = `fact-e2e-golden-${RUN_SUFFIX}-3pgs-link`;
    const { error: linkError } = await pgsClient.rpc("link_procurement_receipt", {
      p_requirement_id: procurementReq?.id,
      p_receipt_id: pkgReceipt?.id,
      p_fulfilled_qty: shortageQty,
      p_correlation_id: linkCorrelationId,
    });
    expect(linkError, linkError?.message).toBeNull();
    record(ledger.stages, "3pgs_link_procurement_receipt", "link_procurement_receipt", "STORE_3RD_PARTY", linkCorrelationId, "PASS", `fulfilled_qty=${shortageQty}`);

    // ---- Now that 3PGS genuinely holds real stock, reserve/issue/acknowledge
    // the P&A requirement for real. reserve_3pgs_requirement_stock's
    // committed-quantity math only counts the first (zero-qty) reservation's
    // reserved+fulfilled, both 0, so this fresh call reserves the full
    // outstanding amount from the now-real balance. ----
    await switchRole(page, hodAssembly);
    const { client: assemblyClient } = await createAuthenticatedCertificationClient(page);

    const freshReserveCorrelationId = `fact-e2e-golden-${RUN_SUFFIX}-3pgs-reserve-real`;
    const { data: realReservation, error: freshReserveError } = await assemblyClient.rpc("reserve_3pgs_requirement_stock", {
      p_requirement_id: pkgRequirementId,
      p_priority: "normal",
      p_correlation_id: freshReserveCorrelationId,
    });
    expect(freshReserveError, freshReserveError?.message).toBeNull();
    expect(Number(realReservation?.reserved_qty ?? 0), "with real 3PGS stock now available, the fresh reservation must reserve the full shortfall").toBe(shortageQty);
    record(ledger.stages, "3pgs_reserve_requirement_real_stock", "reserve_3pgs_requirement_stock", "HOD_ASSEMBLY", freshReserveCorrelationId, "PASS", `reservation_id=${realReservation?.id}, reserved_qty=${realReservation?.reserved_qty}`);

    const issueCorrelationId = `fact-e2e-golden-${RUN_SUFFIX}-3pgs-issue`;
    const { data: issueEvent, error: issueError } = await assemblyClient.rpc("issue_3pgs_requirement_stock", {
      p_requirement_id: pkgRequirementId,
      p_reservation_id: realReservation?.id,
      p_issue_qty: shortageQty,
      p_correlation_id: issueCorrelationId,
    });
    expect(issueError, issueError?.message).toBeNull();
    record(ledger.stages, "3pgs_issue_requirement_stock", "issue_3pgs_requirement_stock", "HOD_ASSEMBLY", issueCorrelationId, "PASS", `issue_event_id=${issueEvent?.id}`);

    // Receiver must be a DIFFERENT actor than the issuer (HOD_ASSEMBLY) --
    // STORE_3RD_PARTY, the 3PGS store's own role, acknowledges physical
    // custody actually leaving 3PGS for Assembly.
    await switchRole(page, store3rdParty);
    const { client: ackClient } = await createAuthenticatedCertificationClient(page);
    const acknowledgeCorrelationId = `fact-e2e-golden-${RUN_SUFFIX}-3pgs-acknowledge`;
    const { data: acknowledgedRequirement, error: acknowledgeError } = await ackClient.rpc("acknowledge_3pgs_requirement_receipt", {
      p_issue_event_id: issueEvent?.id,
      p_received_qty: shortageQty,
      p_correlation_id: acknowledgeCorrelationId,
    });
    expect(acknowledgeError, acknowledgeError?.message).toBeNull();
    expect(acknowledgedRequirement?.status, "the 3PGS requirement must be fulfilled once acknowledged custody covers the full requested quantity").toBe("fulfilled");
    record(ledger.stages, "3pgs_acknowledge_requirement_receipt", "acknowledge_3pgs_requirement_receipt", "STORE_3RD_PARTY", acknowledgeCorrelationId, "PASS", `status=${acknowledgedRequirement?.status}`);

    const { data: pkgComponentAfter } = await ackClient
      .from("b2b_assembly_components")
      .select("reserved_qty,required_qty")
      .eq("id", pkgComponentId)
      .single();
    expect(Number(pkgComponentAfter?.reserved_qty ?? 0), "the 3PGS component must now be genuinely, fully resolved").toBe(Number(pkgComponentAfter?.required_qty ?? -1));

    const { data: jobAfterFulfilment } = await ackClient
      .from("b2b_assembly_jobs")
      .select("status")
      .eq("id", assemblyJobId)
      .single();
    expect(jobAfterFulfilment?.status, "with every component genuinely resolved, the job must advance to materials_reserved").toBe("materials_reserved");
  });

  // ---- Stage: P&A execution -- issue components, record consumption,
  // complete the job, and QC-accept its output. Every step here operates on
  // P&A's own temporary output custody, never RGS/3PGS/FINISHED_GOODS stock
  // directly (accept_assembly_output's own comment: that credit only ever
  // happens through a later, real physical handover). ----
  await test.step("P&A: issue_assembly_components -> record_assembly_consumption -> complete_assembly_job -> accept_assembly_output", async () => {
    await switchRole(page, hodAssembly);
    const { client } = await createAuthenticatedCertificationClient(page);

    const issueComponentsCorrelationId = `fact-e2e-golden-${RUN_SUFFIX}-issue-components`;
    const { data: issuedJob, error: issueComponentsError } = await client.rpc("issue_assembly_components", {
      p_assembly_job_id: assemblyJobId,
      p_correlation_id: issueComponentsCorrelationId,
    });
    expect(issueComponentsError, issueComponentsError?.message).toBeNull();
    expect(issuedJob?.status, "components must be issued once every requirement is materials_reserved").toBe("issued");
    record(ledger.stages, "pna_issue_assembly_components", "issue_assembly_components", "HOD_ASSEMBLY", issueComponentsCorrelationId, "PASS", `status=${issuedJob?.status}`);

    const fgConsumptionCorrelationId = `fact-e2e-golden-${RUN_SUFFIX}-consume-fg`;
    const { error: fgConsumptionError } = await client.rpc("record_assembly_consumption", {
      p_component_id: fgComponentId,
      p_consumed_qty: 5,
      p_wasted_qty: 0,
      p_returned_qty: 0,
      p_correlation_id: fgConsumptionCorrelationId,
    });
    expect(fgConsumptionError, fgConsumptionError?.message).toBeNull();
    record(ledger.stages, "pna_record_consumption_fg", "record_assembly_consumption", "HOD_ASSEMBLY", fgConsumptionCorrelationId, "PASS", "consumed_qty=5");

    const pkgConsumptionCorrelationId = `fact-e2e-golden-${RUN_SUFFIX}-consume-pkg`;
    const { error: pkgConsumptionError } = await client.rpc("record_assembly_consumption", {
      p_component_id: pkgComponentId,
      p_consumed_qty: 4,
      p_wasted_qty: 0,
      p_returned_qty: 0,
      p_correlation_id: pkgConsumptionCorrelationId,
    });
    expect(pkgConsumptionError, pkgConsumptionError?.message).toBeNull();
    record(ledger.stages, "pna_record_consumption_pkg", "record_assembly_consumption", "HOD_ASSEMBLY", pkgConsumptionCorrelationId, "PASS", "consumed_qty=4");

    const completeCorrelationId = `fact-e2e-golden-${RUN_SUFFIX}-complete-job`;
    const { data: completedJob, error: completeError } = await client.rpc("complete_assembly_job", {
      p_assembly_job_id: assemblyJobId,
      p_completed_qty: 5,
      p_correlation_id: completeCorrelationId,
    });
    expect(completeError, completeError?.message).toBeNull();
    expect(completedJob?.status, "completion moves the job to QC, not directly to a closed state").toBe("qc_pending");
    record(ledger.stages, "pna_complete_assembly_job", "complete_assembly_job", "HOD_ASSEMBLY", completeCorrelationId, "PASS", `status=${completedJob?.status}`);

    const acceptOutputCorrelationId = `fact-e2e-golden-${RUN_SUFFIX}-accept-output`;
    const { data: acceptedJob, error: acceptOutputError } = await client.rpc("accept_assembly_output", {
      p_assembly_job_id: assemblyJobId,
      p_accepted_qty: 5,
      p_rejected_qty: 0,
      p_correlation_id: acceptOutputCorrelationId,
    });
    expect(acceptOutputError, acceptOutputError?.message).toBeNull();
    expect(acceptedJob?.status, "a fully accepted output must reach the accepted state").toBe("accepted");
    record(ledger.stages, "pna_accept_assembly_output", "accept_assembly_output", "HOD_ASSEMBLY", acceptOutputCorrelationId, "PASS", `status=${acceptedJob?.status}`);
  });

  // ---- Stage: receiver-acknowledged custody handover of P&A's accepted
  // output to the FINISHED_GOODS store, then Core #177's binding of that
  // acknowledged handover into the existing governed inventory-receipt
  // authority -- the ONLY thing that actually credits FINISHED_GOODS stock
  // for an assembled output. ----
  await test.step("P&A->FINISHED_GOODS: initiate/acknowledge handover -> Core #177 receipt binding -> GRN credits stock", async () => {
    const { client } = await createAuthenticatedCertificationClient(page);

    const initiateHandoverCorrelationId = `fact-e2e-golden-${RUN_SUFFIX}-initiate-handover`;
    const { data: handover, error: initiateHandoverError } = await client.rpc("initiate_assembly_handover", {
      p_assembly_job_id: assemblyJobId,
      p_destination_type: "RGS",
      p_destination_reference: "FINISHED_GOODS",
      p_dispatched_qty: 5,
      p_carton_count: 1,
      p_evidence_reference: `factory-cert://golden-order/${RUN_SUFFIX}-handover.jpg`,
      p_correlation_id: initiateHandoverCorrelationId,
    });
    expect(initiateHandoverError, initiateHandoverError?.message).toBeNull();
    const handoverId = handover?.id as string;
    record(ledger.stages, "pna_initiate_assembly_handover", "initiate_assembly_handover", "HOD_ASSEMBLY", initiateHandoverCorrelationId, "PASS", `handover_id=${handoverId}`);

    // Receiver must be a different actor than the dispatcher (HOD_ASSEMBLY).
    await switchRole(page, storeReadyGoods);
    const { client: rgsClient } = await createAuthenticatedCertificationClient(page);
    const acknowledgeHandoverCorrelationId = `fact-e2e-golden-${RUN_SUFFIX}-acknowledge-handover`;
    const { data: acknowledgedHandover, error: acknowledgeHandoverError } = await rgsClient.rpc("acknowledge_assembly_handover", {
      p_handover_id: handoverId,
      p_received_qty: 5,
      p_evidence_reference: `factory-cert://golden-order/${RUN_SUFFIX}-received.jpg`,
      p_correlation_id: acknowledgeHandoverCorrelationId,
    });
    expect(acknowledgeHandoverError, acknowledgeHandoverError?.message).toBeNull();
    expect(acknowledgedHandover?.status, "a fully received handover must reach the acknowledged state").toBe("acknowledged");
    record(ledger.stages, "pna_acknowledge_assembly_handover", "acknowledge_assembly_handover", "STORE_READY_GOODS", acknowledgeHandoverCorrelationId, "PASS", `status=${acknowledgedHandover?.status}`);

    // Core #177: bind this exact acknowledged handover into the existing
    // governed receipt authority -- product/SKU/destination/bound quantity
    // are all server-derived from the handover, never caller-supplied.
    const createHandoverReceiptCorrelationId = `fact-e2e-golden-${RUN_SUFFIX}-handover-receipt-create`;
    const { data: handoverReceipt, error: createHandoverReceiptError } = await rgsClient.rpc("create_b2b_inventory_receipt_from_assembly_handover", {
      p_handover_id: handoverId,
      p_receipt_number: `FACT-E2E-${RUN_SUFFIX}-FG-RCPT`,
      p_expected_qty: 5,
      p_correlation_id: createHandoverReceiptCorrelationId,
    });
    expect(createHandoverReceiptError, createHandoverReceiptError?.message).toBeNull();
    record(ledger.stages, "fg_create_receipt_from_handover", "create_b2b_inventory_receipt_from_assembly_handover", "STORE_READY_GOODS", createHandoverReceiptCorrelationId, "PASS", `receipt_id=${handoverReceipt?.id}`);

    const { data: handoverReceiptLine } = await rgsClient
      .from("b2b_inventory_receipt_lines")
      .select("id")
      .eq("receipt_id", handoverReceipt?.id)
      .single();

    // record/accept_b2b_inventory_receipt both require the EXACT correlation
    // id the receipt was created with -- reuse createHandoverReceiptCorrelationId
    // throughout this receipt's lifecycle rather than minting a fresh one.
    const recordHandoverReceiptCorrelationId = createHandoverReceiptCorrelationId;
    const { error: recordHandoverReceiptError } = await rgsClient.rpc("record_b2b_inventory_receipt", {
      p_receipt_id: handoverReceipt?.id,
      p_lines: [{ line_id: handoverReceiptLine?.id, received_qty: 5 }],
      p_correlation_id: recordHandoverReceiptCorrelationId,
    });
    expect(recordHandoverReceiptError, recordHandoverReceiptError?.message).toBeNull();
    record(ledger.stages, "fg_record_receipt_from_handover", "record_b2b_inventory_receipt", "STORE_READY_GOODS", recordHandoverReceiptCorrelationId, "PASS", "received_qty=5");

    const { data: fgBalanceBeforeAccept } = await rgsClient
      .from("inventory_stock_balances")
      .select("version,available_qty")
      .eq("product_id", "20000000-0000-4000-8000-000000000101")
      .eq("location_code", "FINISHED_GOODS")
      .maybeSingle();

    const acceptHandoverReceiptCorrelationId = createHandoverReceiptCorrelationId;
    const { error: acceptHandoverReceiptError } = await rgsClient.rpc("accept_b2b_inventory_receipt", {
      p_receipt_id: handoverReceipt?.id,
      p_lines: [{
        line_id: handoverReceiptLine?.id,
        accepted_qty: 5,
        damaged_qty: 0,
        rejected_qty: 0,
        expected_balance_version: fgBalanceBeforeAccept?.version ?? 0,
      }],
      p_correlation_id: acceptHandoverReceiptCorrelationId,
    });
    expect(acceptHandoverReceiptError, acceptHandoverReceiptError?.message).toBeNull();
    record(ledger.stages, "fg_accept_receipt_from_handover", "accept_b2b_inventory_receipt", "STORE_READY_GOODS", acceptHandoverReceiptCorrelationId, "PASS", "accepted_qty=5");

    const { data: fgBin } = await rgsClient
      .from("b2b_inventory_bins")
      .select("id,bin_code")
      .eq("store_code", "FINISHED_GOODS")
      .eq("bin_code", "FACT-E2E-FG-BIN-01")
      .single();

    const fgPutawayAllocCorrelationId = `fact-e2e-golden-${RUN_SUFFIX}-fg-putaway-alloc`;
    const { data: fgPutawayTasks, error: fgPutawayAllocError } = await rgsClient.rpc("allocate_b2b_inventory_putaway", {
      p_receipt_id: handoverReceipt?.id,
      p_allocations: [{ line_id: handoverReceiptLine?.id, bin_id: fgBin?.id, disposition: "accepted", quantity: 5 }],
      p_correlation_id: fgPutawayAllocCorrelationId,
    });
    expect(fgPutawayAllocError, fgPutawayAllocError?.message).toBeNull();
    const fgPutawayTaskId = (fgPutawayTasks as { id: string }[] | null)?.[0]?.id;
    record(ledger.stages, "fg_allocate_putaway", "allocate_b2b_inventory_putaway", "STORE_READY_GOODS", fgPutawayAllocCorrelationId, "PASS", `task_id=${fgPutawayTaskId}`);

    const fgPutawayConfirmCorrelationId = `fact-e2e-golden-${RUN_SUFFIX}-fg-putaway-confirm`;
    const { error: fgPutawayConfirmError } = await rgsClient.rpc("confirm_b2b_inventory_putaway", {
      p_task_id: fgPutawayTaskId,
      p_bin_code: fgBin?.bin_code,
      p_quantity: 5,
      p_correlation_id: fgPutawayConfirmCorrelationId,
    });
    expect(fgPutawayConfirmError, fgPutawayConfirmError?.message).toBeNull();
    record(ledger.stages, "fg_confirm_putaway", "confirm_b2b_inventory_putaway", "STORE_READY_GOODS", fgPutawayConfirmCorrelationId, "PASS", "placed_qty=5");

    const fgGrnCorrelationId = `fact-e2e-golden-${RUN_SUFFIX}-fg-grn`;
    const { error: fgGrnError } = await rgsClient.rpc("finalise_b2b_inventory_grn", {
      p_receipt_id: handoverReceipt?.id,
      p_grn_number: `FACT-E2E-${RUN_SUFFIX}-FG-GRN`,
      p_correlation_id: fgGrnCorrelationId,
    });
    expect(fgGrnError, fgGrnError?.message).toBeNull();
    record(ledger.stages, "fg_finalise_grn", "finalise_b2b_inventory_grn", "STORE_READY_GOODS", fgGrnCorrelationId, "PASS", "grn finalised");

    const { data: fgBalanceAfterGrn, error: fgBalanceAfterGrnError } = await rgsClient
      .from("inventory_stock_balances")
      .select("available_qty")
      .eq("product_id", "20000000-0000-4000-8000-000000000101")
      .eq("location_code", "FINISHED_GOODS")
      .single();
    expect(fgBalanceAfterGrnError, fgBalanceAfterGrnError?.message).toBeNull();
    expect(
      Number(fgBalanceAfterGrn?.available_qty ?? 0),
      "assembled output must genuinely credit FINISHED_GOODS available_qty only via GRN finalisation, closing the previously-reported P&A output-credit gap",
    ).toBeGreaterThan(Number(fgBalanceBeforeAccept?.available_qty ?? 0));
  });

  // ---- Stage: Dispatch consignment/carton/scan/evidence/lock/DPL/Finance ----
  await test.step("Dispatch: create_b2b_dispatch_consignment -> open_b2b_dispatch_carton", async () => {
    await switchRole(page, dispatchManager);
    const { client } = await createAuthenticatedCertificationClient(page);

    // NEGATIVE: unauthorized role cannot create a consignment.
    await switchRole(page, store3rdParty);
    const { client: unauthorizedClient } = await createAuthenticatedCertificationClient(page);
    const unauthorizedCorrelationId = `fact-e2e-golden-${RUN_SUFFIX}-unauthorized-consignment`;
    const { error: unauthorizedError } = await unauthorizedClient.rpc("create_b2b_dispatch_consignment", {
      p_order_id: GOLDEN_ORDER_ID,
      p_dispatch_mode: "road_transporter",
      p_lines: [{ order_item_id: GOLDEN_ORDER_ITEM_ID, selected_qty: 5 }],
      p_correlation_id: unauthorizedCorrelationId,
    });
    expect(unauthorizedError, "STORE_3RD_PARTY must not be able to create a dispatch consignment").not.toBeNull();
    record(ledger.negative_paths, "unauthorized_consignment_create_rejected", "create_b2b_dispatch_consignment", "STORE_3RD_PARTY", unauthorizedCorrelationId, unauthorizedError ? "PASS" : "FAIL", unauthorizedError?.message ?? "RPC unexpectedly succeeded");

    await switchRole(page, dispatchManager);
    const { client: authorizedClient } = await createAuthenticatedCertificationClient(page);
    const createCorrelationId = `fact-e2e-golden-${RUN_SUFFIX}-consignment`;
    const { data: consignment, error: consignmentError } = await authorizedClient.rpc("create_b2b_dispatch_consignment", {
      p_order_id: GOLDEN_ORDER_ID,
      p_dispatch_mode: "road_transporter",
      p_lines: [{ order_item_id: GOLDEN_ORDER_ITEM_ID, selected_qty: 5 }],
      p_correlation_id: createCorrelationId,
    });
    expect(consignmentError, consignmentError?.message).toBeNull();
    consignmentId = consignment?.id as string;
    record(ledger.stages, "dispatch_create_consignment", "create_b2b_dispatch_consignment", "DISPATCH_MANAGER", createCorrelationId, "PASS", `consignment_id=${consignmentId}`);

    const { data: carton, error: cartonError } = await authorizedClient.rpc("open_b2b_dispatch_carton", {
      p_consignment_id: consignmentId,
      p_carton_code: `FACT-E2E-${RUN_SUFFIX}-C1`,
    });
    expect(cartonError, cartonError?.message).toBeNull();
    cartonId = carton?.id as string;
    record(ledger.stages, "dispatch_open_carton", "open_b2b_dispatch_carton", "DISPATCH_MANAGER", null, "PASS", `carton_id=${cartonId}`);
  });

  // ---- Stage: Core #174 source-to-Dispatch accepted-ready custody. Before
  // this, a freshly created consignment line's accepted_ready_qty defaults
  // to 0 and no RPC ever raised it -- record_b2b_dispatch_carton_item_scan's
  // own packed_qty<=accepted_ready_qty gate made every scan unreachable.
  // declare/record/accept close that gap by driving the pre-existing (but
  // previously unreachable) b2b_dispatch_handoffs custody chain. ----
  await test.step("Dispatch: Core #174 source handoff declare -> record -> accept (raises accepted_ready_qty)", async () => {
    await switchRole(page, hodAssembly);
    const { client: sourceClient } = await createAuthenticatedCertificationClient(page);

    const declareCorrelationId = `fact-e2e-golden-${RUN_SUFFIX}-handoff-declare`;
    const { data: sourceHandoff, error: declareError } = await sourceClient.rpc("declare_b2b_dispatch_source_handoff", {
      p_consignment_id: consignmentId,
      p_source_department: "PACKING_ASSEMBLY",
      p_source_location: "PACKING_ASSEMBLY",
      p_lines: [{ order_item_id: GOLDEN_ORDER_ITEM_ID, declared_qty: 5 }],
      p_correlation_id: declareCorrelationId,
    });
    expect(declareError, declareError?.message).toBeNull();
    const sourceHandoffId = sourceHandoff?.id as string;
    record(ledger.stages, "dispatch_declare_source_handoff", "declare_b2b_dispatch_source_handoff", "HOD_ASSEMBLY", declareCorrelationId, "PASS", `handoff_id=${sourceHandoffId}`);

    // Dispatch records physical receipt of the declared handoff (must be a
    // different actor than the declaring source).
    await switchRole(page, dispatchManager);
    const { client: dispatchClient } = await createAuthenticatedCertificationClient(page);
    const recordHandoffCorrelationId = `fact-e2e-golden-${RUN_SUFFIX}-handoff-record`;
    const { error: recordHandoffError } = await dispatchClient.rpc("record_b2b_dispatch_handoff_receipt", {
      p_handoff_id: sourceHandoffId,
      p_lines: [{ order_item_id: GOLDEN_ORDER_ITEM_ID, physically_received_qty: 5 }],
      p_correlation_id: recordHandoffCorrelationId,
    });
    expect(recordHandoffError, recordHandoffError?.message).toBeNull();
    record(ledger.stages, "dispatch_record_source_handoff_receipt", "record_b2b_dispatch_handoff_receipt", "DISPATCH_MANAGER", recordHandoffCorrelationId, "PASS", "physically_received_qty=5");

    const { data: consignmentLineBefore } = await dispatchClient
      .from("b2b_dispatch_consignment_lines")
      .select("accepted_ready_qty")
      .eq("consignment_id", consignmentId)
      .single();

    const acceptHandoffCorrelationId = `fact-e2e-golden-${RUN_SUFFIX}-handoff-accept`;
    const { error: acceptHandoffError } = await dispatchClient.rpc("accept_b2b_dispatch_handoff", {
      p_handoff_id: sourceHandoffId,
      p_lines: [{ order_item_id: GOLDEN_ORDER_ITEM_ID, accepted_qty: 5, held_qty: 0, rejected_qty: 0 }],
      p_correlation_id: acceptHandoffCorrelationId,
    });
    expect(acceptHandoffError, acceptHandoffError?.message).toBeNull();
    record(ledger.stages, "dispatch_accept_source_handoff", "accept_b2b_dispatch_handoff", "DISPATCH_MANAGER", acceptHandoffCorrelationId, "PASS", "accepted_qty=5");

    const { data: consignmentLineAfter, error: consignmentLineAfterError } = await dispatchClient
      .from("b2b_dispatch_consignment_lines")
      .select("accepted_ready_qty")
      .eq("consignment_id", consignmentId)
      .single();
    expect(consignmentLineAfterError, consignmentLineAfterError?.message).toBeNull();
    expect(
      Number(consignmentLineAfter?.accepted_ready_qty ?? 0),
      "accepting the source handoff must be what genuinely raises accepted_ready_qty, closing the previously-reported Core #174 gap",
    ).toBeGreaterThan(Number(consignmentLineBefore?.accepted_ready_qty ?? 0));
  });

  await test.step("Dispatch: scan -> evidence -> lock (with negative paths)", async () => {
    const { client } = await createAuthenticatedCertificationClient(page);
    const { data: line } = await client
      .from("b2b_dispatch_consignment_lines")
      .select("id")
      .eq("consignment_id", consignmentId)
      .single();
    const lineId = line?.id as string;

    const scanCorrelationId = `fact-e2e-golden-${RUN_SUFFIX}-scan`;
    const { data: scanResult, error: scanError } = await client.rpc("record_b2b_dispatch_carton_item_scan", {
      p_carton_id: cartonId,
      p_consignment_line_id: lineId,
      p_barcode_value: "CERT-ARABIC-001",
      p_batch_lot: `BATCH-${RUN_SUFFIX}`,
      p_quantity: 5,
      p_correlation_id: scanCorrelationId,
    });
    expect(scanError, scanError?.message).toBeNull();
    if (scanResult?.scan_result !== "verified") {
      record(ledger.stages, "dispatch_scan_item", "record_b2b_dispatch_carton_item_scan", "DISPATCH_MANAGER", scanCorrelationId, "FAIL", `scan_result=${scanResult?.scan_result}, reason=${scanResult?.reason ?? "none"}`);
    }
    expect(
      scanResult?.scan_result,
      `Scan rejected: ${scanResult?.reason ?? "unknown"}`,
    ).toBe("verified");
    record(ledger.stages, "dispatch_scan_item", "record_b2b_dispatch_carton_item_scan", "DISPATCH_MANAGER", scanCorrelationId, "PASS", `scan_result=${scanResult?.scan_result}`);

    // NEGATIVE: idempotent retry with the same correlation id -- no duplicate.
    const { data: retryResult, error: retryError } = await client.rpc("record_b2b_dispatch_carton_item_scan", {
      p_carton_id: cartonId,
      p_consignment_line_id: lineId,
      p_barcode_value: "CERT-ARABIC-001",
      p_batch_lot: `BATCH-${RUN_SUFFIX}`,
      p_quantity: 5,
      p_correlation_id: scanCorrelationId,
    });
    expect(retryError, retryError?.message).toBeNull();
    const { count: scanEventCount } = await client
      .from("b2b_dispatch_product_scan_events")
      .select("id", { count: "exact", head: true })
      .eq("correlation_id", scanCorrelationId);
    expect(scanEventCount, "an idempotent retry must not create a duplicate scan event").toBe(1);
    record(ledger.negative_paths, "idempotent_scan_retry_no_duplicate", "record_b2b_dispatch_carton_item_scan", "DISPATCH_MANAGER", scanCorrelationId, scanEventCount === 1 ? "PASS" : "FAIL", `retry_result=${retryResult?.scan_result}, event_count=${scanEventCount}`);

    // NEGATIVE: quantity exceeding the consignment line's authoritative remaining quantity.
    const overflowCorrelationId = `fact-e2e-golden-${RUN_SUFFIX}-scan-overflow`;
    const { data: overflowResult, error: overflowError } = await client.rpc("record_b2b_dispatch_carton_item_scan", {
      p_carton_id: cartonId,
      p_consignment_line_id: lineId,
      p_barcode_value: "CERT-ARABIC-001",
      p_batch_lot: `BATCH-${RUN_SUFFIX}`,
      p_quantity: 999,
      p_correlation_id: overflowCorrelationId,
    });
    const overflowRejected = Boolean(overflowError) || overflowResult?.scan_result !== "verified";
    expect(overflowRejected, "a scan quantity exceeding the authoritative remaining quantity must be rejected").toBe(true);
    record(ledger.negative_paths, "quantity_overflow_scan_rejected", "record_b2b_dispatch_carton_item_scan", "DISPATCH_MANAGER", overflowCorrelationId, overflowRejected ? "PASS" : "FAIL", overflowError?.message ?? `scan_result=${overflowResult?.scan_result}`);

    // NEGATIVE: lock rejected before evidence is recorded.
    const earlyLockCorrelationId = `fact-e2e-golden-${RUN_SUFFIX}-early-lock`;
    const { data: cartonRow } = await client.from("b2b_dispatch_cartons").select("current_version").eq("id", cartonId).single();
    const { error: earlyLockError } = await client.rpc("lock_b2b_dispatch_carton", {
      p_carton_id: cartonId,
      p_expected_version: cartonRow?.current_version,
      p_correlation_id: earlyLockCorrelationId,
    });
    expect(earlyLockError, "locking before evidence is recorded must be rejected").not.toBeNull();
    record(ledger.negative_paths, "lock_before_evidence_rejected", "lock_b2b_dispatch_carton", "DISPATCH_MANAGER", earlyLockCorrelationId, earlyLockError ? "PASS" : "FAIL", earlyLockError?.message ?? "RPC unexpectedly succeeded");

    const evidenceCorrelationId = `fact-e2e-golden-${RUN_SUFFIX}-evidence`;
    const { error: evidenceError } = await client.rpc("record_b2b_dispatch_carton_evidence", {
      p_carton_id: cartonId,
      p_net_weight: 4.5,
      p_gross_weight: 5,
      p_open_photo_ref: `factory-cert://golden-order/${RUN_SUFFIX}.jpg`,
      p_correlation_id: evidenceCorrelationId,
    });
    expect(evidenceError, evidenceError?.message).toBeNull();
    record(ledger.stages, "dispatch_record_evidence", "record_b2b_dispatch_carton_evidence", "DISPATCH_MANAGER", evidenceCorrelationId, "PASS", "net=4.5 gross=5");

    // NEGATIVE: stale expected_version rejected.
    const staleLockCorrelationId = `fact-e2e-golden-${RUN_SUFFIX}-stale-lock`;
    const { error: staleLockError } = await client.rpc("lock_b2b_dispatch_carton", {
      p_carton_id: cartonId,
      p_expected_version: -1,
      p_correlation_id: staleLockCorrelationId,
    });
    expect(staleLockError, "locking with a stale expected_version must be rejected").not.toBeNull();
    record(ledger.negative_paths, "stale_version_lock_rejected", "lock_b2b_dispatch_carton", "DISPATCH_MANAGER", staleLockCorrelationId, staleLockError ? "PASS" : "FAIL", staleLockError?.message ?? "RPC unexpectedly succeeded");

    const { data: cartonAfterEvidence } = await client.from("b2b_dispatch_cartons").select("current_version").eq("id", cartonId).single();
    const lockCorrelationId = `fact-e2e-golden-${RUN_SUFFIX}-lock`;
    const { error: lockError } = await client.rpc("lock_b2b_dispatch_carton", {
      p_carton_id: cartonId,
      p_expected_version: cartonAfterEvidence?.current_version,
      p_correlation_id: lockCorrelationId,
    });
    expect(lockError, lockError?.message).toBeNull();
    record(ledger.stages, "dispatch_lock_carton", "lock_b2b_dispatch_carton", "DISPATCH_MANAGER", lockCorrelationId, "PASS", "locked");

    // NEGATIVE: post-lock mutation rejected. record_b2b_dispatch_carton_item_scan
    // soft-rejects (scan_result <> 'verified', no thrown error) once the
    // carton's status leaves ('open','under_packing','photo_required') --
    // same non-throwing shape as the overflow/idempotent-retry checks above,
    // not an RPC-level error.
    const postLockScanCorrelationId = `fact-e2e-golden-${RUN_SUFFIX}-post-lock-scan`;
    const { data: postLockScanResult, error: postLockScanError } = await client.rpc("record_b2b_dispatch_carton_item_scan", {
      p_carton_id: cartonId,
      p_consignment_line_id: lineId,
      p_barcode_value: `FACT-E2E-${RUN_SUFFIX}-POST-LOCK`,
      p_batch_lot: `BATCH-${RUN_SUFFIX}`,
      p_quantity: 1,
      p_correlation_id: postLockScanCorrelationId,
    });
    const postLockRejected = Boolean(postLockScanError) || postLockScanResult?.scan_result !== "verified";
    expect(postLockRejected, "no further scan may succeed against a locked carton").toBe(true);
    record(ledger.negative_paths, "post_lock_mutation_rejected", "record_b2b_dispatch_carton_item_scan", "DISPATCH_MANAGER", postLockScanCorrelationId, postLockRejected ? "PASS" : "FAIL", postLockScanError?.message ?? `scan_result=${postLockScanResult?.scan_result}`);
  });

  await test.step("Dispatch: DPL create -> supersede -> submit to Finance", async () => {
    const { client } = await createAuthenticatedCertificationClient(page);

    const createDplCorrelationId = `fact-e2e-golden-${RUN_SUFFIX}-dpl-create`;
    const { data: dpl, error: dplError } = await client.rpc("create_b2b_dispatch_packing_list", {
      p_consignment_id: consignmentId,
      p_correlation_id: createDplCorrelationId,
    });
    expect(dplError, dplError?.message).toBeNull();
    dplVersionId = dpl?.id as string;
    record(ledger.stages, "dispatch_create_dpl", "create_b2b_dispatch_packing_list", "DISPATCH_MANAGER", createDplCorrelationId, "PASS", `version_id=${dplVersionId}`);

    // NEGATIVE: supersession with a blank reason must not reach the RPC (UI-level
    // guard mirrored here by asserting the RPC itself rejects an empty reason).
    const blankReasonCorrelationId = `fact-e2e-golden-${RUN_SUFFIX}-supersede-blank`;
    const { error: blankReasonError } = await client.rpc("supersede_b2b_dispatch_packing_list", {
      p_consignment_id: consignmentId,
      p_current_version_id: dplVersionId,
      p_reason: "",
      p_correlation_id: blankReasonCorrelationId,
    });
    expect(blankReasonError, "supersession with a blank reason must be rejected").not.toBeNull();
    record(ledger.negative_paths, "blank_reason_supersession_rejected", "supersede_b2b_dispatch_packing_list", "DISPATCH_MANAGER", blankReasonCorrelationId, blankReasonError ? "PASS" : "FAIL", blankReasonError?.message ?? "RPC unexpectedly succeeded");

    const supersedeCorrelationId = `fact-e2e-golden-${RUN_SUFFIX}-supersede`;
    const { data: supersededDpl, error: supersedeError } = await client.rpc("supersede_b2b_dispatch_packing_list", {
      p_consignment_id: consignmentId,
      p_current_version_id: dplVersionId,
      p_reason: "FACT-E2E golden-order deliberate correction",
      p_correlation_id: supersedeCorrelationId,
    });
    expect(supersedeError, supersedeError?.message).toBeNull();
    const newDplVersionId = supersededDpl?.id as string;
    record(ledger.stages, "dispatch_supersede_dpl", "supersede_b2b_dispatch_packing_list", "DISPATCH_MANAGER", supersedeCorrelationId, "PASS", `new_version_id=${newDplVersionId}`);

    const { data: history, error: historyError } = await client
      .from("b2b_dispatch_packing_list_versions")
      .select("id,status")
      .eq("consignment_id", consignmentId)
      .order("version_number", { ascending: true });
    expect(historyError, historyError?.message).toBeNull();
    expect(history?.some((v) => v.id === dplVersionId && v.status === "superseded"), "the original version must remain visible in history as superseded").toBe(true);

    // NEGATIVE: unauthorized submit rejected.
    await switchRole(page, store3rdParty);
    const { client: unauthorizedClient } = await createAuthenticatedCertificationClient(page);
    const unauthorizedSubmitCorrelationId = `fact-e2e-golden-${RUN_SUFFIX}-unauthorized-submit`;
    const { error: unauthorizedSubmitError } = await unauthorizedClient.rpc("submit_b2b_dispatch_packing_list_to_finance", {
      p_consignment_id: consignmentId,
      p_version_id: newDplVersionId,
      p_correlation_id: unauthorizedSubmitCorrelationId,
    });
    expect(unauthorizedSubmitError, "STORE_3RD_PARTY must not be able to submit the DPL to Finance").not.toBeNull();
    record(ledger.negative_paths, "unauthorized_dpl_submit_rejected", "submit_b2b_dispatch_packing_list_to_finance", "STORE_3RD_PARTY", unauthorizedSubmitCorrelationId, unauthorizedSubmitError ? "PASS" : "FAIL", unauthorizedSubmitError?.message ?? "RPC unexpectedly succeeded");

    await switchRole(page, dispatchManager);
    const { client: authorizedClient } = await createAuthenticatedCertificationClient(page);
    const submitCorrelationId = `fact-e2e-golden-${RUN_SUFFIX}-submit`;
    const { error: submitError } = await authorizedClient.rpc("submit_b2b_dispatch_packing_list_to_finance", {
      p_consignment_id: consignmentId,
      p_version_id: newDplVersionId,
      p_correlation_id: submitCorrelationId,
    });
    expect(submitError, submitError?.message).toBeNull();

    const { data: finalVersion, error: finalVersionError } = await authorizedClient
      .from("b2b_dispatch_packing_list_versions")
      .select("submitted_to_finance_at,finance_check_state")
      .eq("id", newDplVersionId)
      .single();
    expect(finalVersionError, finalVersionError?.message).toBeNull();
    expect(finalVersion?.submitted_to_finance_at, "submitted_to_finance_at must be set on the authoritative record after reload").toBeTruthy();
    record(ledger.stages, "dispatch_submit_to_finance", "submit_b2b_dispatch_packing_list_to_finance", "DISPATCH_MANAGER", submitCorrelationId, "PASS", `finance_check_state=${finalVersion?.finance_check_state}`);
  });

  await test.step("Write FACT-E2E golden-order ledger", async () => {
    const failedStages = ledger.stages.filter((s) => s.status === "FAIL");
    const failedNegativePaths = ledger.negative_paths.filter((s) => s.status === "FAIL");
    const summary = {
      schema_version: 1,
      status: failedStages.length === 0 && failedNegativePaths.length === 0 ? "PASS" : "FAIL",
      environment: "disposable-local-core",
      production_accessed: false,
      run_token: RUN_SUFFIX,
      order_id: GOLDEN_ORDER_ID,
      assembly_job_id: assemblyJobId,
      consignment_id: consignmentId,
      carton_id: cartonId,
      generated_at: new Date().toISOString(),
      total_stages: ledger.stages.length,
      total_negative_paths: ledger.negative_paths.length,
      failed_stages: failedStages.map((s) => s.stage),
      failed_negative_paths: failedNegativePaths.map((s) => s.stage),
      stages: ledger.stages,
      negative_paths: ledger.negative_paths,
    };
    writeFileSync("factory-fact-e2e-golden-order.json", `${JSON.stringify(summary, null, 2)}\n`, "utf8");
    expect(summary.status, `golden-order ledger recorded failures: ${JSON.stringify([...failedStages, ...failedNegativePaths])}`).toBe("PASS");
  });
});
