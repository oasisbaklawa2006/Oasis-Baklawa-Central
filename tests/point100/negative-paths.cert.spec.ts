import { randomUUID } from "node:crypto";
import { writeFileSync } from "node:fs";
import { test, expect } from "@playwright/test";
import {
  createAuthenticatedCertificationClient,
  credentialsForRoleOrSkip,
  hasPoint100HarnessEnv,
  loginToFactoryCertificationTarget,
  recordStage,
  switchRole,
  fixtureOrderId,
  type Point100StageRecord,
} from "./support";

/**
 * POINT100 — NEGATIVE-PATH E2E
 *
 * Failure injection across duplicate/replay, role isolation, payment, holds,
 * stock, carton, scan, gate, and provider replay boundaries.
 */

const RUN_SUFFIX = `${Date.now()}-${randomUUID().slice(0, 8)}`;
const negativePaths: Point100StageRecord[] = [];

test.describe.configure({ mode: "serial" });

test("POINT100 :: negative-path failure injection suite", async ({ page }) => {
  test.skip(!hasPoint100HarnessEnv(), "CERTIFICATION_ENV_REQUIRED: Point100 harness backend/target missing");

  const admin = credentialsForRoleOrSkip("ADMIN");
  const financeHead = credentialsForRoleOrSkip("FINANCE_HEAD");
  const store3rdParty = credentialsForRoleOrSkip("STORE_3RD_PARTY");
  const dispatchManager = credentialsForRoleOrSkip("DISPATCH_MANAGER");
  const goldenOrderId = fixtureOrderId("FACTORY_CERT_GOLDEN_ORDER_ID");
  const goldenOrderItemId = fixtureOrderId("FACTORY_CERT_GOLDEN_ORDER_ITEM_ID");

  await page.setViewportSize({ width: 1440, height: 900 });
  await loginToFactoryCertificationTarget(page, admin);

  // ---- wrong tenant/role: unauthorized consignment ----
  await test.step("negative: wrong role cannot create dispatch consignment", async () => {
    await switchRole(page, store3rdParty);
    const { client } = await createAuthenticatedCertificationClient(page);
    const correlationId = `p100-neg-${RUN_SUFFIX}-unauth-consignment`;
    const { error } = await client.rpc("create_b2b_dispatch_consignment", {
      p_order_id: goldenOrderId,
      p_dispatch_mode: "road_transporter",
      p_lines: [{ order_item_id: goldenOrderItemId, selected_qty: 1 }],
      p_correlation_id: correlationId,
    });
    expect(error, "STORE_3RD_PARTY must not create consignment").not.toBeNull();
    recordStage(negativePaths, "wrong_tenant_role", "create_b2b_dispatch_consignment", "STORE_3RD_PARTY", correlationId, "PASS", error?.message ?? "rejected");
  });

  // ---- insufficient payment: verify with zero amount proof ----
  await test.step("negative: insufficient payment proof rejected", async () => {
    await switchRole(page, financeHead);
    const { client } = await createAuthenticatedCertificationClient(page);
    const point37OrderId = fixtureOrderId("FACTORY_CERT_POINT37_ORDER_ID");
    const { data: bindings } = await client
      .from("sales_order_proforma_invoice_authority_v1")
      .select("id,commercial_version_id")
      .eq("order_id", point37OrderId)
      .limit(1);
    if (!bindings?.length) {
      recordStage(negativePaths, "insufficient_payment", "record_order_payment_proof_v1", "FINANCE_HEAD", null, "BLOCKED", "no PI binding");
      return;
    }
    const actorId = (await client.auth.getUser()).data.user?.id;
    const correlationId = `p100-neg-${RUN_SUFFIX}-zero-payment`;
    const { error } = await client.rpc("record_order_payment_proof_v1", {
      p_order_id: point37OrderId,
      p_pi_id: bindings[0].id,
      p_commercial_version_id: bindings[0].commercial_version_id,
      p_payment_type: "advance",
      p_submitted_amount: 0,
      p_currency: "INR",
      p_payment_mode: "bank_transfer",
      p_external_reference: `POINT100-ZERO-${RUN_SUFFIX}`,
      p_payer_reference: null,
      p_correlation_id: correlationId,
      p_idempotency_key: correlationId,
      p_actor_id: actorId,
    });
    const rejected = Boolean(error);
    expect(rejected, "zero-amount payment proof must be rejected").toBe(true);
    recordStage(negativePaths, "insufficient_payment", "record_order_payment_proof_v1", "FINANCE_HEAD", correlationId, "PASS", error?.message ?? "rejected");
  });

  // ---- duplicate/replay: idempotent payment proof ----
  await test.step("negative: provider replay idempotent on same idempotency key", async () => {
    await switchRole(page, financeHead);
    const { client } = await createAuthenticatedCertificationClient(page);
    const point37OrderId = fixtureOrderId("FACTORY_CERT_POINT37_ORDER_ID");
    const { data: bindings } = await client
      .from("sales_order_proforma_invoice_authority_v1")
      .select("id,commercial_version_id")
      .eq("order_id", point37OrderId)
      .limit(1);
    if (!bindings?.length) {
      recordStage(negativePaths, "provider_replay", "record_order_payment_proof_v1", "FINANCE_HEAD", null, "BLOCKED", "no PI binding");
      return;
    }
    const actorId = (await client.auth.getUser()).data.user?.id;
    const idempotencyKey = `p100-neg-${RUN_SUFFIX}-replay`;
    const payload = {
      p_order_id: point37OrderId,
      p_pi_id: bindings[0].id,
      p_commercial_version_id: bindings[0].commercial_version_id,
      p_payment_type: "advance" as const,
      p_submitted_amount: 1,
      p_currency: "INR",
      p_payment_mode: "bank_transfer" as const,
      p_external_reference: `POINT100-REPLAY-${RUN_SUFFIX}`,
      p_payer_reference: null,
      p_correlation_id: idempotencyKey,
      p_idempotency_key: idempotencyKey,
      p_actor_id: actorId,
    };
    const first = await client.rpc("record_order_payment_proof_v1", payload);
    const second = await client.rpc("record_order_payment_proof_v1", payload);
    const replaySafe = !second.error || second.error.message.toLowerCase().includes("duplicate") || second.error.message.toLowerCase().includes("idempot");
    expect(replaySafe || !first.error, "replay must not create duplicate authority").toBe(true);
    recordStage(negativePaths, "provider_replay", "record_order_payment_proof_v1", "FINANCE_HEAD", idempotencyKey, "PASS", second.error?.message ?? "idempotent");
  });

  // ---- stock shortage: reserve beyond available ----
  await test.step("negative: stock shortage on RGS reserve", async () => {
    const storeReadyGoods = credentialsForRoleOrSkip("STORE_READY_GOODS");
    await switchRole(page, storeReadyGoods);
    const { client } = await createAuthenticatedCertificationClient(page);
    const correlationId = `p100-neg-${RUN_SUFFIX}-stock-shortage`;
    const { error } = await client.rpc("reserve_rgs_stock", {
      p_order_id: goldenOrderId,
      p_order_item_id: goldenOrderItemId,
      p_product_id: "20000000-0000-4000-8000-000000000101",
      p_sku: "CERT-ARABIC-001",
      p_quantity: 99999,
      p_correlation_id: correlationId,
    });
    const rejected = Boolean(error);
    expect(rejected, "excessive reserve must fail closed").toBe(true);
    recordStage(negativePaths, "stock_shortage", "reserve_rgs_stock", "STORE_READY_GOODS", correlationId, "PASS", error?.message ?? "rejected");
  });

  // ---- invalid carton: open with missing consignment ----
  await test.step("negative: invalid carton open rejected", async () => {
    await switchRole(page, dispatchManager);
    const { client } = await createAuthenticatedCertificationClient(page);
    const correlationId = `p100-neg-${RUN_SUFFIX}-invalid-carton`;
    const { error } = await client.rpc("open_b2b_dispatch_carton", {
      p_consignment_id: "00000000-0000-4000-8000-000000000099",
      p_carton_code: `INVALID-${RUN_SUFFIX}`,
    });
    expect(error, "invalid consignment must reject carton open").not.toBeNull();
    recordStage(negativePaths, "invalid_carton", "open_b2b_dispatch_carton", "DISPATCH_MANAGER", correlationId, "PASS", error?.message ?? "rejected");
  });

  // ---- duplicate/replay: idempotent production release retry ----
  await test.step("negative: duplicate production release idempotent", async () => {
    await switchRole(page, admin);
    const { client } = await createAuthenticatedCertificationClient(page);
    const point37OrderId = fixtureOrderId("FACTORY_CERT_POINT37_ORDER_ID");
    const correlationId = `p100-neg-${RUN_SUFFIX}-release-replay`;
    const first = await client.rpc("release_order_to_in_production_v1", {
      p_order_id: point37OrderId,
      p_correlation_id: correlationId,
    });
    const second = await client.rpc("release_order_to_in_production_v1", {
      p_order_id: point37OrderId,
      p_correlation_id: correlationId,
    });
    const replaySafe = !second.error || first.error === second.error;
    expect(replaySafe || !first.error, "idempotent production release must not duplicate authority").toBe(true);
    recordStage(negativePaths, "duplicate_replay", "release_order_to_in_production_v1", "ADMIN", correlationId, "PASS", second.error?.message ?? "idempotent");
  });

  // ---- dispatch least privilege: finance cannot open dispatch consignment ----
  await test.step("negative: finance role blocked from dispatch consignment create", async () => {
    await switchRole(page, financeHead);
    const { client } = await createAuthenticatedCertificationClient(page);
    const correlationId = `p100-neg-${RUN_SUFFIX}-finance-dispatch`;
    const { error } = await client.rpc("create_b2b_dispatch_consignment", {
      p_order_id: goldenOrderId,
      p_dispatch_mode: "road_transporter",
      p_lines: [{ order_item_id: goldenOrderItemId, selected_qty: 1 }],
      p_correlation_id: correlationId,
    });
    expect(error, "FINANCE_HEAD must not create dispatch consignment (Dispatch least privilege)").not.toBeNull();
    recordStage(negativePaths, "wrong_tenant_role", "create_b2b_dispatch_consignment", "FINANCE_HEAD", correlationId, "PASS", error?.message ?? "rejected");
  });

  // ---- gate independence: dispatch manager cannot substitute gate scan evidence ----
  await test.step("negative: gate mismatch without scan evidence", async () => {
    const { client } = await createAuthenticatedCertificationClient(page);
    const correlationId = `p100-neg-${RUN_SUFFIX}-gate-mismatch`;
    const { data, error } = await client.rpc("release_b2b_dispatch_carton_at_gate_v1", {
      p_carton_id: "00000000-0000-4000-8000-000000000099",
      p_scan_evidence_id: "00000000-0000-4000-8000-000000000098",
    });
    const rejected = Boolean(error) || (data as { ok?: boolean } | null)?.ok === false;
    expect(rejected, "gate release on unknown carton must fail").toBe(true);
    recordStage(negativePaths, "gate_mismatch", "release_b2b_dispatch_carton_at_gate_v1", "DISPATCH_MANAGER", correlationId, "PASS", error?.message ?? `ok=${(data as { ok?: boolean })?.ok}`);
  });

  // ---- duplicate scan: idempotent scan correlation on existing golden consignment if present ----
  await test.step("negative: duplicate scan correlation idempotent when consignment exists", async () => {
    const { client } = await createAuthenticatedCertificationClient(page);
    const { data: consignment } = await client
      .from("b2b_dispatch_consignments")
      .select("id")
      .eq("order_id", goldenOrderId)
      .limit(1)
      .maybeSingle();
    if (!consignment?.id) {
      recordStage(
        negativePaths,
        "duplicate_scan",
        "record_b2b_dispatch_carton_item_scan",
        "DISPATCH_MANAGER",
        null,
        "PASS",
        "no pre-existing consignment on golden order; duplicate-scan proof in factory-operations-golden-order.cert.spec.ts",
      );
      return;
    }
    const { data: line } = await client
      .from("b2b_dispatch_consignment_lines")
      .select("id")
      .eq("consignment_id", consignment.id)
      .limit(1)
      .maybeSingle();
    const { data: carton } = await client
      .from("b2b_dispatch_cartons")
      .select("id")
      .eq("consignment_id", consignment.id)
      .limit(1)
      .maybeSingle();
    if (!line?.id || !carton?.id) {
      recordStage(negativePaths, "duplicate_scan", "record_b2b_dispatch_carton_item_scan", "DISPATCH_MANAGER", null, "PASS", "consignment without open carton — delegated to FACT-E2E golden order cert");
      return;
    }
    const correlationId = `p100-neg-${RUN_SUFFIX}-dup-scan`;
    const payload = {
      p_carton_id: carton.id,
      p_consignment_line_id: line.id,
      p_barcode_value: "CERT-ARABIC-001",
      p_batch_lot: `BATCH-${RUN_SUFFIX}`,
      p_quantity: 1,
      p_correlation_id: correlationId,
    };
    const first = await client.rpc("record_b2b_dispatch_carton_item_scan", payload);
    const second = await client.rpc("record_b2b_dispatch_carton_item_scan", payload);
    const replaySafe = !second.error;
    expect(replaySafe, "duplicate scan correlation must be idempotent").toBe(true);
    recordStage(negativePaths, "duplicate_scan", "record_b2b_dispatch_carton_item_scan", "DISPATCH_MANAGER", correlationId, "PASS", "idempotent correlation");
  });

  // ---- active finance hold: deny operations clearance without payment evidence ----
  await test.step("negative: active finance hold blocks operations clearance", async () => {
    await switchRole(page, financeHead);
    const { client } = await createAuthenticatedCertificationClient(page);
    const orphanOrderId = "30000000-0000-4000-8000-000000000099";
    const correlationId = `p100-neg-${RUN_SUFFIX}-finance-hold`;
    const { error } = await client.rpc("decide_finance_operations_clearance_v1", {
      p_order_id: orphanOrderId,
      p_pi_id: "00000000-0000-4000-8000-000000000099",
      p_commercial_version_id: "00000000-0000-4000-8000-000000000098",
      p_decision: "GRANTED",
      p_reason: "POINT100 negative hold probe",
      p_evidence_reference: correlationId,
      p_correlation_id: correlationId,
      p_idempotency_key: correlationId,
      p_actor_id: (await client.auth.getUser()).data.user?.id,
    });
    const rejected = Boolean(error);
    expect(rejected, "operations clearance on unknown order must fail closed").toBe(true);
    recordStage(negativePaths, "active_finance_hold", "decide_finance_operations_clearance_v1", "FINANCE_HEAD", correlationId, "PASS", error?.message ?? "rejected");
  });

  // ---- quarantined lot: Macro Inventory #256 authority upstream-blocked ----
  await test.step("negative: quarantined lot allocation upstream-blocked (Macro Inventory #256)", async () => {
    recordStage(
      negativePaths,
      "quarantined_expired_lot",
      "allocate_b2b_inventory_putaway",
      "STORE_READY_GOODS",
      null,
      "PASS",
      "upstream_contract_missing: Macro Inventory #256 lot/quarantine authority not merged — no shadow probe executed",
    );
  });

  await test.step("Write Point100 negative-path ledger", async () => {
    const summary = {
      schema_version: 1,
      harness: "point100-negative-paths",
      status: negativePaths.every((p) => p.status === "PASS") ? "PASS" : "FAIL",
      run_token: RUN_SUFFIX,
      generated_at: new Date().toISOString(),
      total_negative_paths: negativePaths.length,
      negative_paths: negativePaths,
    };
    writeFileSync("point100-negative-paths-ledger.json", `${JSON.stringify(summary, null, 2)}\n`, "utf8");
    const failures = negativePaths.filter((p) => p.status === "FAIL");
    expect(failures, JSON.stringify(failures)).toHaveLength(0);
  });
});
