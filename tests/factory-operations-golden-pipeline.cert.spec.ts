import { writeFileSync } from "node:fs";
import { test, expect, type Page } from "@playwright/test";
import { loadGoldenChainOrderState } from "../src/lib/golden-chain-operator/goldenChainOrderQueries";
import { factoryCertificationCredentialSpec } from "../src/lib/factoryCertificationCredentialPolicy";
import {
  createAuthenticatedCertificationClient,
  dismissOnboardingOverlayIfPresent,
  hasFactoryCertificationBackend,
  hasFactoryCertificationTarget,
  loginToFactoryCertificationTarget,
  readFactoryCertificationCredentials,
  resolveFactoryCertificationTarget,
  verifyAuthenticatedRole,
} from "./factory-certification/support";

/**
 * POINT 38 — GOLDEN PIPELINE ORDER STATUS / GOVERNANCE-BOARD E2E CERTIFICATION
 *
 * Proves the Golden Chain Operator Wizard drives a cleared_for_dispatch order
 * through governed governance-board stages (dispatch evidence → finance release →
 * readiness review → completion attestation → dispatch finalization) with truthful
 * order status / history / lineage, and without direct orders.update bypass.
 *
 * Fixture: FACTORY_CERT_POINT38_ORDER_ID seeded at cleared_for_dispatch via
 * scripts/factory-certification/seed-production-fixtures.mjs.
 *
 * Ledger: factory-point38-golden-pipeline.json
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

function point38OrderId(): string {
  const id = process.env.FACTORY_CERT_POINT38_ORDER_ID?.trim();
  if (!id) throw new Error("CERTIFICATION_FIXTURE_REQUIRED: FACTORY_CERT_POINT38_ORDER_ID missing");
  return id;
}

function credentialsForRoleOrSkip(role: string) {
  const spec = factoryCertificationCredentialSpec(role);
  const credentials = readFactoryCertificationCredentials(role);
  test.skip(!credentials, `CREDENTIAL_REQUIRED: ${spec.emailEnv} + ${spec.passwordEnv}`);
  return credentials!;
}

async function switchRole(page: Page, role: string) {
  const credentials = credentialsForRoleOrSkip(role);
  await page.context().clearCookies();
  await page.evaluate(() => {
    try {
      window.localStorage.clear();
      window.sessionStorage.clear();
    } catch {
      // best-effort
    }
  });
  await loginToFactoryCertificationTarget(page, credentials);
  await verifyAuthenticatedRole(page, role);
}

async function openWizardAndSelectOrder(page: Page, orderLabel: string) {
  const target = resolveFactoryCertificationTarget();
  await page.goto(`${target}/admin/golden-chain-operator`, {
    waitUntil: "domcontentloaded",
    timeout: 60_000,
  });
  await dismissOnboardingOverlayIfPresent(page);
  await expect(page.getByRole("heading", { name: /Golden Chain Operator/i })).toBeVisible({
    timeout: 30_000,
  });
  const orderBtn = page.getByRole("button", { name: orderLabel }).first();
  await expect(orderBtn, `order ${orderLabel} must appear in wizard list`).toBeVisible({ timeout: 60_000 });
  await orderBtn.click();
  await expect(page.getByText(orderLabel, { exact: false }).first()).toBeVisible({ timeout: 30_000 });
}

async function clickWizardPrimaryCta(page: Page): Promise<string> {
  const cta = page
    .locator("div.fixed.bottom-0 button")
    .filter({ hasNotText: /Working/i })
    .first();
  await expect(cta).toBeEnabled({ timeout: 30_000 });
  const label = ((await cta.textContent()) ?? "").trim();
  await cta.click();
  return label;
}

async function waitWizardStageAdvance(page: Page, prevCta: string, timeoutMs = 90_000) {
  await expect
    .poll(
      async () => {
        const sticky = page.locator("div.fixed.bottom-0 button").last();
        const text = ((await sticky.textContent()) ?? "").trim();
        return text !== prevCta && !text.includes("Working");
      },
      { timeout: timeoutMs },
    )
    .toBeTruthy();
}

test.describe.configure({ mode: "serial" });

test("POINT-38 :: Golden Pipeline governance-board order status E2E", async ({ page }) => {
  test.skip(!hasFactoryCertificationTarget(), "CERTIFICATION_ENV_REQUIRED: FACTORY_CERT_TARGET_URL missing");
  test.skip(!hasFactoryCertificationBackend(), "CERTIFICATION_ENV_REQUIRED: Factory certification Supabase backend missing");

  const orderId = point38OrderId();
  credentialsForRoleOrSkip("DISPATCH_MANAGER");
  credentialsForRoleOrSkip("FINANCE_HEAD");
  credentialsForRoleOrSkip("PROD_ARABIC_SWEETS");
  let orderLabel = orderId.slice(0, 8).toUpperCase();

  const rpcCalls: Array<{ fn: string }> = [];
  const patchCalls: string[] = [];
  page.on("request", (req) => {
    if (req.method() === "POST" && /\/rest\/v1\/rpc\//.test(req.url())) {
      const fn = decodeURIComponent(req.url().split("/rpc/")[1]?.split("?")[0] ?? "");
      rpcCalls.push({ fn });
    }
    if (req.method() === "PATCH" && /\/rest\/v1\/orders/.test(req.url())) {
      patchCalls.push(req.url());
    }
  });

  await page.setViewportSize({ width: 1440, height: 900 });

  // ---- Fixture gate: cleared_for_dispatch order exists ----
  await test.step("fixture: cleared_for_dispatch golden-pipeline order", async () => {
    await loginToFactoryCertificationTarget(page, credentialsForRoleOrSkip("DISPATCH_MANAGER"));
    await verifyAuthenticatedRole(page, "DISPATCH_MANAGER");
    const { client } = await createAuthenticatedCertificationClient(page);

    const { data: orderRows, error: orderError } = await client
      .from("orders")
      .select("id,order_number,status,payment_status,payment_cleared,advance_paid,advance_required")
      .eq("id", orderId)
      .limit(1);
    if (orderError) throw new Error(`BACKEND_READ_FAILED orders: ${orderError.message}`);
    expect(orderRows, `Point-38 fixture order ${orderId} must exist`).toHaveLength(1);
    const order = orderRows![0];
    expect(String(order.status), "fixture must be cleared_for_dispatch").toBe("cleared_for_dispatch");
    expect(Boolean(order.payment_cleared), "fixture must have payment_cleared").toBe(true);
    orderLabel = String(order.order_number ?? "").trim() || orderId.slice(0, 8).toUpperCase();
    record("fixture_cleared_for_dispatch_order", null, "DISPATCH_MANAGER", "PASS", `status=${order.status} label=${orderLabel}`);
  });

  // ---- Golden chain stage derivation: initial stage ----
  await test.step("derivation: initial stage is prepare_dispatch_evidence", async () => {
    const { client } = await createAuthenticatedCertificationClient(page);
    const state = await loadGoldenChainOrderState(client, orderId);
    expect(state, "golden chain state must load").toBeTruthy();
    expect(state!.orderStatus).toBe("cleared_for_dispatch");
    expect(state!.stage).toBe("prepare_dispatch_evidence");
    record("golden_chain_initial_stage", null, "DISPATCH_MANAGER", "PASS", `stage=${state!.stage}`);
  });

  // ---- UI: wizard surfaces order and initial CTA ----
  await test.step("UI: wizard shows Prepare dispatch evidence CTA", async () => {
    await openWizardAndSelectOrder(page, orderLabel);
    const cta = page.locator("div.fixed.bottom-0 button").filter({ hasNotText: /Working/i }).first();
    await expect(cta).toBeEnabled();
    await expect(cta).toContainText(/Prepare dispatch evidence/i);
    record("ui_wizard_initial_cta", null, "DISPATCH_MANAGER", "PASS", "Prepare dispatch evidence");
  });

  // ---- Governance: prepare dispatch evidence ----
  await test.step("governance: prepare dispatch evidence", async () => {
    const prev = await clickWizardPrimaryCta(page);
    await waitWizardStageAdvance(page, prev);
    const { client } = await createAuthenticatedCertificationClient(page);
    const { data: evidence, error } = await client
      .from("dispatch_readiness_evidence")
      .select("evidence_type,evidence_status")
      .eq("order_id", orderId);
    if (error) throw new Error(`BACKEND_READ_FAILED dispatch_readiness_evidence: ${error.message}`);
    const types = new Set((evidence ?? []).map((row) => String(row.evidence_type)));
    for (const required of ["packing_photo", "document_placeholder", "gate_scan"]) {
      expect(types.has(required), `missing ${required}`).toBe(true);
    }
    const state = await loadGoldenChainOrderState(client, orderId);
    expect(state?.stage).toBe("finance_release");
    record("governance_prepare_evidence", null, "DISPATCH_MANAGER", "PASS", `types=${[...types].join(",")}`);
  });

  // ---- Governance: finance commercial release ----
  await test.step("governance: finance commercial release", async () => {
    await switchRole(page, "FINANCE_HEAD");
    await openWizardAndSelectOrder(page, orderLabel);
    const prev = await clickWizardPrimaryCta(page);
    await waitWizardStageAdvance(page, prev);
    const { client } = await createAuthenticatedCertificationClient(page);
    const { data: financeEvidence, error } = await client
      .from("finance_review_evidence")
      .select("review_type,review_status")
      .eq("order_id", orderId)
      .order("created_at", { ascending: false })
      .limit(5);
    if (error) throw new Error(`BACKEND_READ_FAILED finance_review_evidence: ${error.message}`);
    const released = (financeEvidence ?? []).some(
      (row) => String(row.review_type) === "commercial_release" && String(row.review_status) === "released",
    );
    expect(released, "commercial_release evidence must exist").toBe(true);
    const state = await loadGoldenChainOrderState(client, orderId);
    expect(state?.stage).toBe("readiness_review");
    record("governance_finance_release", null, "FINANCE_HEAD", "PASS", "commercial_release");
  });

  // ---- Governance: readiness review ----
  await test.step("governance: readiness review", async () => {
    await switchRole(page, "DISPATCH_MANAGER");
    await openWizardAndSelectOrder(page, orderLabel);
    const prev = await clickWizardPrimaryCta(page);
    await waitWizardStageAdvance(page, prev);
    const { client } = await createAuthenticatedCertificationClient(page);
    const { data: evidence, error } = await client
      .from("dispatch_readiness_evidence")
      .select("evidence_type,evidence_status")
      .eq("order_id", orderId)
      .eq("evidence_type", "manual_readiness_review");
    if (error) throw new Error(`BACKEND_READ_FAILED readiness review: ${error.message}`);
    expect((evidence ?? []).some((row) => String(row.evidence_status) === "verified")).toBe(true);
    const state = await loadGoldenChainOrderState(client, orderId);
    expect(state?.stage).toBe("completion_attestation");
    record("governance_readiness_review", null, "DISPATCH_MANAGER", "PASS", "manual_readiness_review");
  });

  // ---- Governance: completion attestation ----
  await test.step("governance: completion attestation", async () => {
    const prev = await clickWizardPrimaryCta(page);
    await waitWizardStageAdvance(page, prev);
    const { client } = await createAuthenticatedCertificationClient(page);
    const { data: completion, error } = await client
      .from("dispatch_completion_evidence")
      .select("evidence_type,evidence_status")
      .eq("order_id", orderId);
    if (error) throw new Error(`BACKEND_READ_FAILED dispatch_completion_evidence: ${error.message}`);
    expect((completion ?? []).length).toBeGreaterThan(0);
    const state = await loadGoldenChainOrderState(client, orderId);
    expect(state?.stage).toBe("dispatch_finalization");
    record("governance_completion_attestation", null, "DISPATCH_MANAGER", "PASS", `rows=${completion?.length ?? 0}`);
  });

  // ---- Governance: dispatch finalization → dispatched status truth ----
  await test.step("governance: dispatch finalization sets orders.status=dispatched", async () => {
    const prev = await clickWizardPrimaryCta(page);
    await Promise.race([
      waitWizardStageAdvance(page, prev).catch(() => undefined),
      page.waitForTimeout(5_000),
    ]);

    const { client } = await createAuthenticatedCertificationClient(page);
    const { data: orderRows, error: orderError } = await client
      .from("orders")
      .select("id,status")
      .eq("id", orderId)
      .limit(1);
    if (orderError) throw new Error(`BACKEND_READ_FAILED orders: ${orderError.message}`);
    expect(String(orderRows?.[0]?.status)).toBe("dispatched");

    const { data: lineage, error: lineageError } = await client
      .from("dispatch_release_lineage")
      .select("release_type,next_status")
      .eq("order_id", orderId)
      .order("created_at", { ascending: false })
      .limit(3);
    if (lineageError) throw new Error(`BACKEND_READ_FAILED dispatch_release_lineage: ${lineageError.message}`);
    expect((lineage ?? []).some((row) => String(row.next_status) === "dispatched")).toBe(true);

    const { data: historyRows, error: historyError } = await client
      .from("order_status_history")
      .select("old_status,new_status")
      .eq("order_id", orderId)
      .order("changed_at", { ascending: false })
      .limit(10);
    if (historyError) throw new Error(`BACKEND_READ_FAILED order_status_history: ${historyError.message}`);
    const transition = (historyRows ?? []).find(
      (row) =>
        String(row.old_status) === "cleared_for_dispatch" && String(row.new_status) === "dispatched",
    );
    expect(transition, "order_status_history must record cleared_for_dispatch → dispatched").toBeTruthy();

    const state = await loadGoldenChainOrderState(client, orderId);
    expect(state?.stage).toBe("reservation");
    expect(state?.orderStatus).toBe("dispatched");

    record(
      "governance_dispatch_finalize",
      "finalize_dispatch",
      "DISPATCH_MANAGER",
      "PASS",
      `status=dispatched stage=${state?.stage}`,
    );
    record(
      "order_status_history_truth",
      null,
      "DISPATCH_MANAGER",
      "PASS",
      "cleared_for_dispatch→dispatched",
    );
  });

  // ---- OM surface: golden pipeline status visible ----
  await test.step("UI: Order Management shows dispatched golden-pipeline status", async () => {
    const target = resolveFactoryCertificationTarget();
    await page.goto(`${target}/admin/order-management?view=packing`, {
      waitUntil: "domcontentloaded",
      timeout: 60_000,
    });
    await dismissOnboardingOverlayIfPresent(page);
    const orderRow = page.locator("tr", { has: page.getByText(orderLabel, { exact: false }) }).first();
    await expect(orderRow, "dispatched order must appear in packing pipeline view").toBeVisible({
      timeout: 30_000,
    });
    await expect(orderRow.getByText(/dispatched/i).first()).toBeVisible();
    record("om_golden_pipeline_status_surface", null, "DISPATCH_MANAGER", "PASS", "dispatched visible");
  });

  // ---- No direct orders.update during wizard flow ----
  await test.step("authority: no direct orders.update during governance flow", async () => {
    expect(patchCalls.length, "no direct orders PATCH during golden pipeline").toBe(0);
    record("no_direct_orders_update", null, "DISPATCH_MANAGER", "PASS", `patch_calls=${patchCalls.length}`);
  });

  // ---- Fail-closed: unauthorized role cannot mutate order status ----
  await test.step("fail-closed: unauthorized role denied direct order status mutation", async () => {
    await switchRole(page, "PROD_ARABIC_SWEETS");
    const { client } = await createAuthenticatedCertificationClient(page);
    const { data: orderRows } = await client.from("orders").select("status").eq("id", orderId).limit(1);
    expect(String(orderRows?.[0]?.status)).toBe("dispatched");

    const { error } = await client
      .from("orders")
      .update({ status: "cleared_for_dispatch" })
      .eq("id", orderId);
    expect(error, "unauthorized role must not regress order status via direct update").toBeTruthy();
    record(
      "fail_closed_unauthorized",
      null,
      "PROD_ARABIC_SWEETS",
      "PASS",
      error?.message ?? "update denied",
    );
  });

  writeFileSync("factory-point38-golden-pipeline.json", JSON.stringify(ledger, null, 2));
  const failures = ledger.checks.filter((c) => c.status === "FAIL");
  expect(failures, JSON.stringify(ledger, null, 2)).toHaveLength(0);
});
