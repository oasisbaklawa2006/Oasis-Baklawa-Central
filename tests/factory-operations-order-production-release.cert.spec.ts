import { randomUUID } from "node:crypto";
import { writeFileSync } from "node:fs";
import { test, expect } from "@playwright/test";
import { factoryCertificationCredentialSpec } from "../src/lib/factoryCertificationCredentialPolicy";
import {
  createAuthenticatedCertificationClient,
  createSteppedUpCertificationClient,
  dismissOnboardingOverlayIfPresent,
  hasFactoryCertificationBackend,
  hasFactoryCertificationTarget,
  loginToFactoryCertificationTarget,
  readFactoryCertificationCredentials,
  resolveFactoryCertificationTarget,
  verifyAuthenticatedRole,
} from "./factory-certification/support";

/**
 * POINT 37 — GOVERNED confirmed → in_production PRODUCTION RELEASE CERTIFICATION
 *
 * Proves Order Management's "Send to Factory" path for eligible confirmed orders
 * binds only to Core release_order_to_in_production_v1 (never legacy manufacturing
 * or direct orders.update), records status/history truth, is idempotent on retry,
 * and fails closed for ineligible or unauthorized actors.
 *
 * Fixture: FACTORY_CERT_POINT37_ORDER_ID must be seeded at status=confirmed with
 * finance prerequisites via scripts/factory-certification/seed-production-fixtures.mjs.
 *
 * Ledger: factory-point37-production-release.json
 */

type EvidenceRecord = {
  check: string;
  rpc: string | null;
  role: string | null;
  status: "PASS" | "FAIL";
  detail: string;
};

const ledger: { checks: EvidenceRecord[] } = { checks: [] };

function record(
  check: string,
  rpc: string | null,
  role: string | null,
  status: "PASS" | "FAIL",
  detail: string,
) {
  ledger.checks.push({ check, rpc, role, status, detail });
}

function point37OrderId(): string {
  const id = process.env.FACTORY_CERT_POINT37_ORDER_ID?.trim();
  if (!id) throw new Error("CERTIFICATION_FIXTURE_REQUIRED: FACTORY_CERT_POINT37_ORDER_ID missing");
  return id;
}

function credentialsForRoleOrSkip(role: string) {
  const spec = factoryCertificationCredentialSpec(role);
  const credentials = readFactoryCertificationCredentials(role);
  test.skip(!credentials, `CREDENTIAL_REQUIRED: ${spec.emailEnv} + ${spec.passwordEnv}`);
  return credentials!;
}

test.describe.configure({ mode: "serial" });

test("POINT-37 :: governed confirmed → in_production production release", async ({ page }) => {
  test.skip(!hasFactoryCertificationTarget(), "CERTIFICATION_ENV_REQUIRED: FACTORY_CERT_TARGET_URL missing");
  test.skip(!hasFactoryCertificationBackend(), "CERTIFICATION_ENV_REQUIRED: Factory certification Supabase backend missing");

  const orderId = point37OrderId();
  const admin = credentialsForRoleOrSkip("ADMIN");
  const prodArabic = credentialsForRoleOrSkip("PROD_ARABIC_SWEETS");
  const runSuffix = `${Date.now()}-${randomUUID().slice(0, 8)}`;
  let orderLabel = orderId.slice(0, 8).toUpperCase();

  await page.setViewportSize({ width: 1440, height: 900 });

  // ---- Fixture gate: confirmed order exists with finance prerequisites ----
  await test.step("fixture: confirmed order with finance clearance prerequisites", async () => {
    await loginToFactoryCertificationTarget(page, admin);
    await verifyAuthenticatedRole(page, "ADMIN");
    const { client } = await createAuthenticatedCertificationClient(page);

    const { data: orderRows, error: orderError } = await client
      .from("orders")
      .select("id,order_number,status,payment_status,advance_paid,advance_required,sales_order_value")
      .eq("id", orderId)
      .limit(1);
    if (orderError) throw new Error(`BACKEND_READ_FAILED orders: ${orderError.message}`);
    expect(orderRows, `Point-37 fixture order ${orderId} must exist`).toHaveLength(1);
    const order = orderRows![0];
    expect(String(order.status), "fixture must be confirmed before OM release").toBe("confirmed");
    orderLabel = String(order.order_number ?? "").trim() || orderId.slice(0, 8).toUpperCase();
    record("fixture_confirmed_order", null, "ADMIN", "PASS", `status=${order.status} label=${orderLabel}`);

    const financeHead = readFactoryCertificationCredentials("FINANCE_HEAD");
    test.skip(!financeHead, "CREDENTIAL_REQUIRED: FINANCE_HEAD for operations clearance bootstrap");
    await page.context().clearCookies();
    await page.evaluate(() => {
      try {
        window.localStorage.clear();
        window.sessionStorage.clear();
      } catch {
        // best-effort
      }
    });
    await loginToFactoryCertificationTarget(page, financeHead!);
    const steppedUp = await createSteppedUpCertificationClient(page, "FINANCE_HEAD");
    const { data: bindingRows, error: bindingError } = await steppedUp
      .from("sales_order_proforma_invoice_authority_v1")
      .select("id,commercial_version_id,status")
      .eq("order_id", orderId)
      .in("status", ["READY_FOR_ISSUE", "ISSUED"])
      .order("created_at", { ascending: false })
      .limit(2);
    if (bindingError) throw new Error(`BACKEND_READ_FAILED pi binding: ${bindingError.message}`);
    expect(bindingRows?.length ?? 0, "PI binding required for PF-6C clearance").toBe(1);
    const piId = String(bindingRows![0].id);
    const commercialVersionId = String(bindingRows![0].commercial_version_id);

    const { data: facts, error: factsError } = await steppedUp.rpc("get_finance_operations_clearance_facts_v1", {
      p_order_id: orderId,
      p_pi_id: piId,
      p_commercial_version_id: commercialVersionId,
    });
    if (factsError) throw new Error(`RPC_FAILED get_finance_operations_clearance_facts_v1: ${factsError.message}`);
    let factsRow = Array.isArray(facts) ? facts[0] : facts;
    const actorId = (await steppedUp.auth.getUser()).data.user?.id;
    if (!actorId) throw new Error("FINANCE_HEAD actor id missing for clearance bootstrap");

    const readFacts = () => factsRow as {
      latest_clearance_decision?: string | null;
      eligible_for_operations_clearance?: boolean;
      required_advance?: number;
    };

    if (!readFacts().eligible_for_operations_clearance) {
      const requiredAdvance = Number(readFacts().required_advance ?? order.advance_required ?? 0);
      if (!(requiredAdvance > 0)) throw new Error("POINT37_FIXTURE_FUNDING_REQUIRED: required advance missing");
      const proofIdentity = `point37-proof-${runSuffix}`;
      const { data: proofData, error: proofError } = await steppedUp.rpc("record_order_payment_proof_v1", {
        p_order_id: orderId,
        p_pi_id: piId,
        p_commercial_version_id: commercialVersionId,
        p_payment_type: "advance",
        p_submitted_amount: requiredAdvance,
        p_currency: "INR",
        p_payment_mode: "bank_transfer",
        p_external_reference: `FACTORY-CERT-${runSuffix}`,
        p_payer_reference: null,
        p_proof_evidence_reference: `factory-cert-point37:${runSuffix}`,
        p_source_channel: "CENTRAL",
        p_source_reference: `point37-cert:${orderId}`,
        p_correlation_id: `central:pf6a:proof:${proofIdentity}`,
        p_idempotency_key: `central:pf6a:proof:${proofIdentity}`,
        p_actor_id: actorId,
      });
      if (proofError) throw new Error(`RPC_FAILED record_order_payment_proof_v1: ${proofError.message}`);
      const proofRow = Array.isArray(proofData) ? proofData[0] : proofData;
      const paymentId = String((proofRow as { payment_id?: string })?.payment_id ?? "");
      if (!paymentId) throw new Error("POINT37_FIXTURE_FUNDING_REQUIRED: payment_id missing after proof record");
      const verifyIdentity = `point37-verify-${runSuffix}`;
      const { error: verifyError } = await steppedUp.rpc("verify_order_payment_v1", {
        p_payment_id: paymentId,
        p_verified_amount: requiredAdvance,
        p_verified_reference: `FACTORY-CERT-VERIFY-${runSuffix}`,
        p_verification_evidence_reference: `factory-cert-point37-verify:${runSuffix}`,
        p_reason: "Point-37 certification advance verification",
        p_correlation_id: `central:pf6a:verify:${verifyIdentity}`,
        p_idempotency_key: `central:pf6a:verify:${verifyIdentity}`,
        p_actor_id: actorId,
      });
      if (verifyError) throw new Error(`RPC_FAILED verify_order_payment_v1: ${verifyError.message}`);
      record("finance_advance_verified", "verify_order_payment_v1", "FINANCE_HEAD", "PASS", verifyIdentity);

      const { data: refreshedFacts, error: refreshedFactsError } = await steppedUp.rpc("get_finance_operations_clearance_facts_v1", {
        p_order_id: orderId,
        p_pi_id: piId,
        p_commercial_version_id: commercialVersionId,
      });
      if (refreshedFactsError) throw new Error(`RPC_FAILED get_finance_operations_clearance_facts_v1 refresh: ${refreshedFactsError.message}`);
      factsRow = Array.isArray(refreshedFacts) ? refreshedFacts[0] : refreshedFacts;
      if (!readFacts().eligible_for_operations_clearance) {
        throw new Error("POINT37_FIXTURE_FUNDING_REQUIRED: advance verified but operations clearance still ineligible");
      }
    }

    const latestDecision = readFacts().latest_clearance_decision;
    if (latestDecision !== "GRANTED") {
      const identity = `point37-clearance-${runSuffix}`;
      const { error: decideError } = await steppedUp.rpc("decide_finance_operations_clearance_v1", {
        p_order_id: orderId,
        p_pi_id: piId,
        p_commercial_version_id: commercialVersionId,
        p_decision: "GRANTED",
        p_reason: "Point-37 certification bootstrap — Operations Clearance",
        p_evidence_reference: `factory-cert-point37:${runSuffix}`,
        p_source_channel: "CENTRAL",
        p_source_reference: `point37-cert:${orderId}`,
        p_correlation_id: `central:pf6c:point37:${runSuffix}`,
        p_idempotency_key: `central:pf6c:point37:${runSuffix}`,
        p_actor_id: actorId,
      });
      if (decideError) throw new Error(`RPC_FAILED decide_finance_operations_clearance_v1: ${decideError.message}`);
      record("finance_operations_clearance_granted", "decide_finance_operations_clearance_v1", "FINANCE_HEAD", "PASS", identity);
    } else {
      record("finance_operations_clearance_granted", null, "FINANCE_HEAD", "PASS", "already GRANTED");
    }
  });

  // ---- UI + governed release: single ADMIN session (avoid flaky second OM navigation) ----
  await test.step("UI + release: Send to Factory uses governed RPC only", async () => {
    const rpcCalls: Array<{ fn: string; args: Record<string, unknown> | undefined }> = [];
    const patchCalls: string[] = [];
    page.on("request", (req) => {
      if (req.method() === "POST" && /\/rest\/v1\/rpc\//.test(req.url())) {
        const fn = decodeURIComponent(req.url().split("/rpc/")[1]?.split("?")[0] ?? "");
        let args: Record<string, unknown> | undefined;
        const raw = req.postData();
        if (raw) {
          try {
            args = JSON.parse(raw) as Record<string, unknown>;
          } catch {
            args = undefined;
          }
        }
        rpcCalls.push({ fn, args });
      }
      if (req.method() === "PATCH" && /\/rest\/v1\/orders/.test(req.url())) {
        patchCalls.push(req.url());
      }
    });

    await page.context().clearCookies();
    await page.evaluate(() => {
      try {
        window.localStorage.clear();
        window.sessionStorage.clear();
      } catch {
        // best-effort
      }
    });
    await loginToFactoryCertificationTarget(page, admin);
    await verifyAuthenticatedRole(page, "ADMIN");

    const target = resolveFactoryCertificationTarget();
    await page.goto(`${target}/admin/order-management?view=production`, {
      waitUntil: "domcontentloaded",
      timeout: 60_000,
    });
    await dismissOnboardingOverlayIfPresent(page);
    await expect(page.getByRole("heading", { name: "Order Management" })).toBeVisible({ timeout: 30_000 });
    await expect(page.locator("tbody tr").first()).toBeVisible({ timeout: 30_000 });

    const orderRow = page.locator("tr", { has: page.getByText(orderLabel, { exact: false }) }).first();
    await expect(orderRow, "confirmed order must appear in production view").toBeVisible({ timeout: 30_000 });
    const actionButton = orderRow.getByRole("button", { name: /Send to Factory/i });
    await expect(actionButton, "Send to Factory must be available").toBeVisible();
    await expect(actionButton, "Send to Factory must be enabled for confirmed → in_production").toBeEnabled();
    record("ui_action_available", null, "ADMIN", "PASS", "Send to Factory enabled");

    await actionButton.click();

    await expect.poll(
      () => rpcCalls.some((c) => c.fn === "release_order_to_in_production_v1"),
      { timeout: 30_000 },
    ).toBe(true);

    const releaseCalls = rpcCalls.filter((c) => c.fn === "release_order_to_in_production_v1");
    expect(releaseCalls.length, "exactly one production release RPC per action").toBe(1);
    expect(releaseCalls[0].args?.p_order_id).toBe(orderId);
    expect(rpcCalls.some((c) => c.fn === "release_order_to_manufacturing_v1")).toBe(false);
    expect(patchCalls.length, "no direct orders.update during release").toBe(0);

    const { client } = await createAuthenticatedCertificationClient(page);
    const { data: orderRows, error: orderError } = await client
      .from("orders")
      .select("id,status")
      .eq("id", orderId)
      .limit(1);
    if (orderError) throw new Error(`BACKEND_READ_FAILED orders: ${orderError.message}`);
    expect(String(orderRows?.[0]?.status)).toBe("in_production");

    const { data: historyRows, error: historyError } = await client
      .from("order_status_history")
      .select("old_status,new_status,changed_at")
      .eq("order_id", orderId)
      .order("changed_at", { ascending: false })
      .limit(5);
    if (historyError) throw new Error(`BACKEND_READ_FAILED order_status_history: ${historyError.message}`);
    const transition = (historyRows ?? []).find(
      (row) => String(row.old_status) === "confirmed" && String(row.new_status) === "in_production",
    );
    expect(transition, "order_status_history must record confirmed → in_production").toBeTruthy();
    record(
      "governed_release_status_history",
      "release_order_to_in_production_v1",
      "ADMIN",
      "PASS",
      `new_status=in_production history=${transition?.changed_at ?? "recorded"}`,
    );
  });

  // ---- Idempotent retry / no duplicate release ----
  await test.step("idempotent retry returns already_applied without duplicate history", async () => {
    const { client } = await createAuthenticatedCertificationClient(page);
    const { data: historyBefore, error: historyBeforeError } = await client
      .from("order_status_history")
      .select("id")
      .eq("order_id", orderId)
      .eq("old_status", "confirmed")
      .eq("new_status", "in_production");
    if (historyBeforeError) throw new Error(`BACKEND_READ_FAILED order_status_history: ${historyBeforeError.message}`);
    const countBefore = historyBefore?.length ?? 0;

    const { data: retryData, error: retryError } = await client.rpc("release_order_to_in_production_v1", {
      p_order_id: orderId,
    });
    if (retryError) throw new Error(`RPC_FAILED release_order_to_in_production_v1 retry: ${retryError.message}`);
    const retryResult = Array.isArray(retryData) ? retryData[0] : retryData;
    expect((retryResult as { ok?: boolean })?.ok, JSON.stringify(retryResult)).toBe(true);
    expect(
      (retryResult as { already_applied?: boolean })?.already_applied === true
      || (retryResult as { new_status?: string })?.new_status === "in_production",
      "retry must be idempotent",
    ).toBe(true);

    const { data: historyAfter, error: historyAfterError } = await client
      .from("order_status_history")
      .select("id")
      .eq("order_id", orderId)
      .eq("old_status", "confirmed")
      .eq("new_status", "in_production");
    if (historyAfterError) throw new Error(`BACKEND_READ_FAILED order_status_history: ${historyAfterError.message}`);
    expect(historyAfter?.length ?? 0, "no duplicate confirmed→in_production history on retry").toBe(countBefore);
    record("idempotent_retry", "release_order_to_in_production_v1", "ADMIN", "PASS", `history_rows=${countBefore}`);
  });

  // ---- Fail-closed: unauthorized role ----
  await test.step("fail-closed: unauthorized production role denied", async () => {
    await page.context().clearCookies();
    await page.evaluate(() => {
      try {
        window.localStorage.clear();
        window.sessionStorage.clear();
      } catch {
        // best-effort
      }
    });
    await loginToFactoryCertificationTarget(page, prodArabic);
    await verifyAuthenticatedRole(page, "PROD_ARABIC_SWEETS");
    const { client } = await createAuthenticatedCertificationClient(page);
    const { data, error } = await client.rpc("release_order_to_in_production_v1", {
      p_order_id: orderId,
    });
    const result = Array.isArray(data) ? data[0] : data;
    const denied = Boolean(error) || (result as { ok?: boolean })?.ok === false;
    expect(denied, "unauthorized role must not release production").toBe(true);
    record("fail_closed_unauthorized", "release_order_to_in_production_v1", "PROD_ARABIC_SWEETS", "PASS", error?.message ?? "ok=false");
  });

  // ---- Fail-closed: ineligible status (submitted golden order) ----
  await test.step("fail-closed: ineligible submitted order denied", async () => {
    const goldenOrderId = process.env.FACTORY_CERT_GOLDEN_ORDER_ID?.trim();
    test.skip(!goldenOrderId, "CERTIFICATION_FIXTURE_REQUIRED: FACTORY_CERT_GOLDEN_ORDER_ID for negative path");

    await page.context().clearCookies();
    await page.evaluate(() => {
      try {
        window.localStorage.clear();
        window.sessionStorage.clear();
      } catch {
        // best-effort
      }
    });
    await loginToFactoryCertificationTarget(page, admin);
    const { client } = await createAuthenticatedCertificationClient(page);
    const { data: goldenRows, error: goldenError } = await client
      .from("orders")
      .select("status")
      .eq("id", goldenOrderId!)
      .limit(1);
    if (goldenError) throw new Error(`BACKEND_READ_FAILED orders(golden): ${goldenError.message}`);
    expect(goldenRows, `golden order ${goldenOrderId} must exist`).toHaveLength(1);
    const goldenStatus = String(goldenRows![0].status ?? "");
    test.skip(goldenStatus === "in_production", "golden order already released — negative path not applicable this run");

    const { data, error } = await client.rpc("release_order_to_in_production_v1", {
      p_order_id: goldenOrderId,
    });
    const result = Array.isArray(data) ? data[0] : data;
    const denied = Boolean(error) || (result as { ok?: boolean })?.ok === false;
    expect(denied, `submitted/ineligible order (${goldenStatus}) must fail closed`).toBe(true);
    record("fail_closed_ineligible", "release_order_to_in_production_v1", "ADMIN", "PASS", `golden_status=${goldenStatus}`);
  });

  writeFileSync("factory-point37-production-release.json", JSON.stringify(ledger, null, 2));
  const failures = ledger.checks.filter((c) => c.status === "FAIL");
  expect(failures, JSON.stringify(ledger, null, 2)).toHaveLength(0);
});
