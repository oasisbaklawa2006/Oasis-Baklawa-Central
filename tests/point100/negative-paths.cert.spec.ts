import { randomUUID } from "node:crypto";
import { writeFileSync } from "node:fs";
import { test, expect } from "@playwright/test";
import { canAccessSecurityGate } from "@/lib/auth/securityGatePolicy";
import { isAuthorizedForAdminPath } from "@/lib/appverse/routeAccess";
import {
  buildPaymentProofPayload,
  createAuthenticatedCertificationClient,
  createSteppedUpCertificationClient,
  credentialsForRoleOrSkip,
  hasPoint100HarnessEnv,
  loginToFactoryCertificationTarget,
  recordStage,
  switchRole,
  fixtureOrderId,
  type Point100StageRecord,
} from "./support";

/** Point100 negative-path evidence must never convert a missing prerequisite into PASS. */
const RUN_SUFFIX = `${Date.now()}-${randomUUID().slice(0, 8)}`;
const negativePaths: Point100StageRecord[] = [];

test.describe.configure({ mode: "serial" });

test("POINT100 :: negative-path failure injection suite", async ({ page }) => {
  if (!hasPoint100HarnessEnv()) {
    throw new Error("CERTIFICATION_ENV_REQUIRED: Point100 harness backend/target missing");
  }

  const admin = credentialsForRoleOrSkip("ADMIN");
  const financeHead = credentialsForRoleOrSkip("FINANCE_HEAD");
  const store3rdParty = credentialsForRoleOrSkip("STORE_3RD_PARTY");
  const storeReadyGoods = credentialsForRoleOrSkip("STORE_READY_GOODS");
  const dispatchManager = credentialsForRoleOrSkip("DISPATCH_MANAGER");
  const goldenOrderId = fixtureOrderId("FACTORY_CERT_GOLDEN_ORDER_ID");
  const goldenOrderItemId = fixtureOrderId("FACTORY_CERT_GOLDEN_ORDER_ITEM_ID");
  const point37OrderId = fixtureOrderId("FACTORY_CERT_POINT37_ORDER_ID");
  const point38OrderId = fixtureOrderId("FACTORY_CERT_POINT38_ORDER_ID");

  await page.setViewportSize({ width: 1440, height: 900 });
  await loginToFactoryCertificationTarget(page, admin);

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
    recordStage(negativePaths, "wrong_tenant_role", "create_b2b_dispatch_consignment", "STORE_3RD_PARTY", correlationId, "PASS", error!.message);
  });

  await test.step("negative: insufficient payment proof rejected", async () => {
    await switchRole(page, financeHead);
    const { client } = await createAuthenticatedCertificationClient(page);
    const { data: bindings, error: bindingError } = await client
      .from("sales_order_proforma_invoice_authority_v1")
      .select("id,commercial_version_id")
      .eq("order_id", point37OrderId)
      .limit(1);
    if (bindingError || !bindings?.length) {
      recordStage(negativePaths, "insufficient_payment", "record_order_payment_proof_v1", "FINANCE_HEAD", null, "BLOCKED", bindingError?.message ?? "no PI binding");
      return;
    }
    const actorId = (await client.auth.getUser()).data.user?.id;
    if (!actorId) {
      recordStage(negativePaths, "insufficient_payment", "record_order_payment_proof_v1", "FINANCE_HEAD", null, "BLOCKED", "finance actor id missing");
      return;
    }
    const correlationId = `p100-neg-${RUN_SUFFIX}-zero-payment`;
    const { error } = await client.rpc(
      "record_order_payment_proof_v1",
      buildPaymentProofPayload({
        orderId: point37OrderId,
        piId: String(bindings[0].id),
        commercialVersionId: String(bindings[0].commercial_version_id),
        amount: 0,
        actorId,
        runSuffix: `${RUN_SUFFIX}-zero`,
        scope: "neg-insufficient",
      }),
    );
    expect(error, "zero-amount payment proof must be rejected").not.toBeNull();
    recordStage(negativePaths, "insufficient_payment", "record_order_payment_proof_v1", "FINANCE_HEAD", correlationId, "PASS", error!.message);
  });

  await test.step("negative: provider replay is idempotent only after a successful first call", async () => {
    await switchRole(page, financeHead);
    const { client } = await createAuthenticatedCertificationClient(page);
    const { data: bindings, error: bindingError } = await client
      .from("sales_order_proforma_invoice_authority_v1")
      .select("id,commercial_version_id")
      .eq("order_id", point37OrderId)
      .limit(1);
    if (bindingError || !bindings?.length) {
      recordStage(negativePaths, "provider_replay", "record_order_payment_proof_v1", "FINANCE_HEAD", null, "BLOCKED", bindingError?.message ?? "no PI binding");
      return;
    }
    const actorId = (await client.auth.getUser()).data.user?.id;
    if (!actorId) {
      recordStage(negativePaths, "provider_replay", "record_order_payment_proof_v1", "FINANCE_HEAD", null, "BLOCKED", "finance actor id missing");
      return;
    }
    const payload = buildPaymentProofPayload({
      orderId: point37OrderId,
      piId: String(bindings[0].id),
      commercialVersionId: String(bindings[0].commercial_version_id),
      amount: 1,
      actorId,
      runSuffix: `${RUN_SUFFIX}-replay`,
      scope: "neg-replay",
    });
    const first = await client.rpc("record_order_payment_proof_v1", payload);
    expect(first.error, first.error?.message).toBeNull();
    const second = await client.rpc("record_order_payment_proof_v1", payload);
    const replaySafe =
      !second.error ||
      second.error.message.toLowerCase().includes("duplicate") ||
      second.error.message.toLowerCase().includes("idempot");
    expect(replaySafe, second.error?.message ?? "provider replay must be idempotent").toBe(true);
    recordStage(negativePaths, "provider_replay", "record_order_payment_proof_v1", "FINANCE_HEAD", payload.p_correlation_id, "PASS", second.error?.message ?? "idempotent replay");
  });

  await test.step("negative: stock shortage on RGS reserve", async () => {
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
    expect(error, "excessive reserve must fail closed").not.toBeNull();
    recordStage(negativePaths, "stock_shortage", "reserve_rgs_stock", "STORE_READY_GOODS", correlationId, "PASS", error!.message);
  });

  await test.step("negative: invalid carton open rejected", async () => {
    await switchRole(page, dispatchManager);
    const { client } = await createAuthenticatedCertificationClient(page);
    const correlationId = `p100-neg-${RUN_SUFFIX}-invalid-carton`;
    const { error } = await client.rpc("open_b2b_dispatch_carton", {
      p_consignment_id: "00000000-0000-4000-8000-000000000099",
      p_carton_code: `INVALID-${RUN_SUFFIX}`,
    });
    expect(error, "invalid consignment must reject carton open").not.toBeNull();
    recordStage(negativePaths, "invalid_carton", "open_b2b_dispatch_carton", "DISPATCH_MANAGER", correlationId, "PASS", error!.message);
  });

  await test.step("negative: duplicate production release is idempotent", async () => {
    await switchRole(page, admin);
    const { client } = await createAuthenticatedCertificationClient(page);
    let { data: orderRow, error: orderError } = await client.from("orders").select("status").eq("id", point37OrderId).maybeSingle();
    if (orderError || !orderRow) {
      recordStage(negativePaths, "duplicate_replay", "release_order_to_in_production_v1", "ADMIN", null, "BLOCKED", orderError?.message ?? "Point37 order missing");
      return;
    }
    if (String(orderRow.status) === "confirmed") {
      const setup = await client.rpc("release_order_to_in_production_v1", { p_order_id: point37OrderId });
      if (setup.error || (setup.data as { ok?: boolean } | null)?.ok === false) {
        recordStage(negativePaths, "duplicate_replay", "release_order_to_in_production_v1", "ADMIN", null, "BLOCKED", setup.error?.message ?? "could not establish in_production prerequisite");
        return;
      }
      ({ data: orderRow, error: orderError } = await client.from("orders").select("status").eq("id", point37OrderId).maybeSingle());
    }
    if (orderError || String(orderRow?.status) !== "in_production") {
      recordStage(negativePaths, "duplicate_replay", "release_order_to_in_production_v1", "ADMIN", null, "BLOCKED", `order status=${orderRow?.status ?? "missing"}`);
      return;
    }
    const { data: historyBefore } = await client
      .from("order_status_history")
      .select("id")
      .eq("order_id", point37OrderId)
      .eq("old_status", "confirmed")
      .eq("new_status", "in_production");
    const countBefore = historyBefore?.length ?? 0;
    const { data: retryData, error: retryError } = await client.rpc("release_order_to_in_production_v1", { p_order_id: point37OrderId });
    expect(retryError, retryError?.message).toBeNull();
    const retryResult = Array.isArray(retryData) ? retryData[0] : retryData;
    expect((retryResult as { ok?: boolean } | null)?.ok, JSON.stringify(retryResult)).toBe(true);
    expect(
      (retryResult as { already_applied?: boolean } | null)?.already_applied === true ||
        (retryResult as { new_status?: string } | null)?.new_status === "in_production",
      "retry must be idempotent",
    ).toBe(true);
    const { data: historyAfter } = await client
      .from("order_status_history")
      .select("id")
      .eq("order_id", point37OrderId)
      .eq("old_status", "confirmed")
      .eq("new_status", "in_production");
    expect(historyAfter?.length ?? 0, "retry must not add duplicate transition history").toBe(countBefore);
    recordStage(negativePaths, "duplicate_replay", "release_order_to_in_production_v1", "ADMIN", null, "PASS", `history_rows=${countBefore}`);
  });

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
    expect(error, "FINANCE_HEAD must not create dispatch consignment").not.toBeNull();
    recordStage(negativePaths, "wrong_tenant_role", "create_b2b_dispatch_consignment", "FINANCE_HEAD", correlationId, "PASS", error!.message);
  });

  await test.step("negative: dispatch manager denied independent security gate route", async () => {
    expect(canAccessSecurityGate("DISPATCH_MANAGER")).toBe(false);
    expect(isAuthorizedForAdminPath("/security-gate", "DISPATCH_MANAGER")).toBe(false);
    recordStage(negativePaths, "gate_mismatch", null, "DISPATCH_MANAGER", `p100-neg-${RUN_SUFFIX}-gate-route`, "PASS", "independent gate route denied for dispatch roles (#556 least privilege)");
  });

  await test.step("negative: dispatch manager cannot substitute gate evidence", async () => {
    await switchRole(page, dispatchManager);
    const { client } = await createAuthenticatedCertificationClient(page);
    const correlationId = `p100-neg-${RUN_SUFFIX}-gate-mismatch`;
    const { data, error } = await client.rpc("release_b2b_dispatch_carton_at_gate_v1", {
      p_carton_id: "00000000-0000-4000-8000-000000000099",
      p_scan_evidence_id: "00000000-0000-4000-8000-000000000098",
    });
    const rejected = Boolean(error) || (data as { ok?: boolean } | null)?.ok === false;
    expect(rejected, "dispatch role/unknown carton gate release must fail").toBe(true);
    recordStage(negativePaths, "gate_mismatch", "release_b2b_dispatch_carton_at_gate_v1", "DISPATCH_MANAGER", correlationId, "PASS", error?.message ?? `ok=${String((data as { ok?: boolean } | null)?.ok)}`);
  });

  await test.step("negative: duplicate scan correlation returns the existing event", async () => {
    await switchRole(page, dispatchManager);
    const { client } = await createAuthenticatedCertificationClient(page);
    const { data: consignment, error: consignmentError } = await client
      .from("b2b_dispatch_consignments")
      .select("id")
      .eq("order_id", point38OrderId)
      .limit(1)
      .maybeSingle();
    if (consignmentError || !consignment?.id) {
      recordStage(negativePaths, "duplicate_scan", "record_b2b_dispatch_carton_item_scan", "DISPATCH_MANAGER", null, "BLOCKED", consignmentError?.message ?? "Point38 consignment missing");
      return;
    }
    const { data: carton, error: cartonError } = await client
      .from("b2b_dispatch_cartons")
      .select("id")
      .eq("consignment_id", consignment.id)
      .limit(1)
      .maybeSingle();
    if (cartonError || !carton?.id) {
      recordStage(negativePaths, "duplicate_scan", "record_b2b_dispatch_carton_item_scan", "DISPATCH_MANAGER", null, "BLOCKED", cartonError?.message ?? "Point38 carton missing");
      return;
    }
    const { data: event, error: eventError } = await client
      .from("b2b_dispatch_product_scan_events")
      .select("id,barcode_value,correlation_id")
      .eq("carton_id", carton.id)
      .eq("scan_result", "verified")
      .limit(1)
      .maybeSingle();
    if (eventError || !event?.id || !event.barcode_value || !event.correlation_id) {
      recordStage(negativePaths, "duplicate_scan", "record_b2b_dispatch_carton_item_scan", "DISPATCH_MANAGER", null, "BLOCKED", eventError?.message ?? "verified Point38 scan event missing");
      return;
    }
    const { data: item, error: itemError } = await client
      .from("b2b_dispatch_carton_items")
      .select("consignment_line_id,batch_lot,quantity,expiry_date")
      .eq("carton_id", carton.id)
      .eq("barcode_value", event.barcode_value)
      .limit(1)
      .maybeSingle();
    if (itemError || !item?.consignment_line_id || !item.batch_lot) {
      recordStage(negativePaths, "duplicate_scan", "record_b2b_dispatch_carton_item_scan", "DISPATCH_MANAGER", null, "BLOCKED", itemError?.message ?? "verified Point38 carton item missing");
      return;
    }
    const replay = await client.rpc("record_b2b_dispatch_carton_item_scan", {
      p_carton_id: carton.id,
      p_consignment_line_id: item.consignment_line_id,
      p_barcode_value: event.barcode_value,
      p_batch_lot: item.batch_lot,
      p_quantity: Number(item.quantity ?? 1),
      p_correlation_id: event.correlation_id,
      p_expiry_date: item.expiry_date ?? null,
      p_device_id: "point100-replay",
    });
    expect(replay.error, replay.error?.message).toBeNull();
    const replayRow = Array.isArray(replay.data) ? replay.data[0] : replay.data;
    expect((replayRow as { id?: string } | null)?.id, "same correlation must return existing scan event").toBe(String(event.id));
    recordStage(negativePaths, "duplicate_scan", "record_b2b_dispatch_carton_item_scan", "DISPATCH_MANAGER", String(event.correlation_id), "PASS", `replayed_event_id=${event.id}`);
  });

  await test.step("negative: a real active Finance hold is blocking and then released", async () => {
    await switchRole(page, financeHead);
    const client = await createSteppedUpCertificationClient(page, "FINANCE_HEAD");
    const actorId = (await client.auth.getUser()).data.user?.id;
    const { data: order, error: orderError } = await client.from("orders").select("company_id").eq("id", point37OrderId).maybeSingle();
    if (!actorId || orderError || !order?.company_id) {
      recordStage(negativePaths, "active_finance_hold", "apply_finance_hold_v1", "FINANCE_HEAD", null, "BLOCKED", orderError?.message ?? "finance actor/company prerequisite missing");
      return;
    }
    const correlationId = `p100-neg-${RUN_SUFFIX}-finance-hold`;
    const applied = await client.rpc("apply_finance_hold_v1", {
      p_company_id: order.company_id,
      p_order_id: point37OrderId,
      p_final_invoice_id: null,
      p_scope: "ORDER",
      p_amount: 1,
      p_reason: "POINT100 blocking finance hold proof",
      p_evidence_reference: `point100-hold:${RUN_SUFFIX}`,
      p_correlation_id: correlationId,
      p_idempotency_key: `${correlationId}:apply`,
      p_actor_id: actorId,
    });
    expect(applied.error, applied.error?.message).toBeNull();
    const appliedRow = Array.isArray(applied.data) ? applied.data[0] : applied.data;
    const holdEventId = String((appliedRow as { control_event_id?: string } | null)?.control_event_id ?? "");
    expect(holdEventId, "apply_finance_hold_v1 must return control_event_id").not.toBe("");
    try {
      const guard = await client.rpc("assert_no_blocking_finance_hold_v1", { p_order_id: point37OrderId });
      expect(guard.error, "active Finance hold must block the canonical guard").not.toBeNull();
      recordStage(negativePaths, "active_finance_hold", "assert_no_blocking_finance_hold_v1", "FINANCE_HEAD", correlationId, "PASS", guard.error!.message);
    } finally {
      const released = await client.rpc("release_finance_hold_v1", {
        p_hold_event_id: holdEventId,
        p_reason: "POINT100 cleanup after blocking-hold proof",
        p_evidence_reference: `point100-hold-release:${RUN_SUFFIX}`,
        p_correlation_id: `${correlationId}:release`,
        p_idempotency_key: `${correlationId}:release`,
        p_actor_id: actorId,
      });
      expect(released.error, released.error?.message).toBeNull();
    }
  });

  await test.step("negative: quarantined lot exception rejects unknown lot position", async () => {
    await switchRole(page, storeReadyGoods);
    const { client } = await createAuthenticatedCertificationClient(page);
    const correlationId = `p100-neg-${RUN_SUFFIX}-quarantine`;
    const { error } = await client.rpc("record_inventory_lot_exception", {
      p_lot_position_id: "00000000-0000-4000-8000-000000000099",
      p_action: "quarantine",
      p_quantity: 1,
      p_reason: "POINT100 negative quarantine probe",
      p_correlation_id: correlationId,
    });
    expect(error, "unknown lot position must fail closed").not.toBeNull();
    recordStage(negativePaths, "quarantined_expired_lot", "record_inventory_lot_exception", "STORE_READY_GOODS", correlationId, "PASS", error!.message);
  });

  await test.step("negative: trace handover verify rejects invalid evidence", async () => {
    await switchRole(page, storeReadyGoods);
    const { client } = await createAuthenticatedCertificationClient(page);
    const correlationId = `p100-neg-${RUN_SUFFIX}-trace-invalid`;
    const { data, error } = await client.rpc("trace_verify_handover_evidence_v1", {
      p_evidence: {},
      p_prior_hash: null,
      p_expected_action: "TRACE_INVALID_PROBE",
      p_enforce_consumption: false,
    });
    expect(error, "trace verify RPC must be callable on production-certified Core #260").toBeNull();
    expect(data === false, "invalid trace handover evidence must fail closed").toBe(true);
    recordStage(negativePaths, "invalid_trace_evidence", "trace_verify_handover_evidence_v1", "STORE_READY_GOODS", correlationId, "PASS", "invalid evidence returned false");
  });

  await test.step("Write Point100 negative-path ledger", async () => {
    const nonPass = negativePaths.filter((entry) => entry.status !== "PASS");
    const summary = {
      schema_version: 1,
      harness: "point100-negative-paths",
      status: nonPass.length === 0 ? "PASS" : "FAIL",
      run_token: RUN_SUFFIX,
      generated_at: new Date().toISOString(),
      total_negative_paths: negativePaths.length,
      negative_paths: negativePaths,
    };
    writeFileSync("point100-negative-paths-ledger.json", `${JSON.stringify(summary, null, 2)}\n`, "utf8");
    expect(nonPass, JSON.stringify(nonPass)).toHaveLength(0);
  });
});
