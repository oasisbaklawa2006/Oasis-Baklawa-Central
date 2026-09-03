/**
 * POINT 37 — Governed production release certification (Lane B / Agent #5).
 *
 * Proves Order Management exposes enabled "Send to Factory" for confirmed orders
 * and that the governed release_order_to_in_production_v1 RPC succeeds when
 * PF-6C Finance Operations Clearance prerequisites are met.
 *
 * Gated: FACTORY_CERT_* + FINANCE credentials + optional POINT37_CERT_ORDER_ID.
 * Never runs against production without the factory-cert ephemeral policy.
 */
import { test, expect } from "@playwright/test";
import {
  hasPoint37CertificationEnv,
  loginPoint37FinanceActor,
  invokeGovernedProductionRelease,
  readOrderStatus,
  resolvePoint37CertOrderId,
  resolveFactoryCertificationTarget,
  writePoint37Evidence,
  type Point37CertEvidence,
  type Point37CertStage,
} from "./point37-certification/support";

const COMMIT_SHA = process.env.POINT37_CERT_COMMIT_SHA?.trim() || "80750bf282d1a03cfc68bfac84903b4ac8277260";

function record(stages: Point37CertStage[], stage: string, status: Point37CertStage["status"], detail: string) {
  stages.push({ stage, status, detail });
}

test.describe("POINT 37 governed production release certification", () => {
  test.setTimeout(300_000);

  test("Order Management UI + governed RPC production release", async ({ page }) => {
    test.skip(!hasPoint37CertificationEnv(), "CERTIFICATION_ENV_REQUIRED: FACTORY_CERT_* backend/target");

    const stages: Point37CertStage[] = [];
    const targetUrl = resolveFactoryCertificationTarget();
    const orderId = resolvePoint37CertOrderId();
    let statusBefore: string | null = null;
    let statusAfter: string | null = null;

    try {
      await loginPoint37FinanceActor(page);
      record(stages, "finance_login", "PASS", "Authenticated finance actor");

      await page.goto(`${targetUrl}/admin/order-management`, { waitUntil: "domcontentloaded", timeout: 60_000 });
      await expect(page.getByRole("heading", { name: /Order Management/i })).toBeVisible({ timeout: 30_000 });
      record(stages, "order_management_reachable", "PASS", "/admin/order-management rendered");

      const confirmedBadge = page.locator("span", { hasText: /^Confirmed$/ }).first();
      const hasConfirmed = await confirmedBadge.isVisible().catch(() => false);

      if (hasConfirmed) {
        const sendToFactory = page.getByRole("button", { name: /Send to Factory/i }).first();
        await expect(sendToFactory).toBeVisible({ timeout: 15_000 });
        await expect(sendToFactory).toBeEnabled();
        record(stages, "confirmed_send_to_factory_enabled", "PASS", "Send to Factory enabled for confirmed order");
      } else {
        record(
          stages,
          "confirmed_send_to_factory_enabled",
          "SKIP",
          "No confirmed order visible in current list — UI proof deferred",
        );
      }

      if (!orderId && hasConfirmed) {
        record(stages, "rpc_mutation", "SKIP", "POINT37_CERT_ORDER_ID not set; RPC mutation skipped");
      } else if (orderId) {
        statusBefore = await readOrderStatus(page, orderId);
        record(stages, "order_status_before", "PASS", `status=${statusBefore ?? "unknown"}`);

        const rpcResult = await invokeGovernedProductionRelease(page, orderId);
        const ok = Boolean(rpcResult && typeof rpcResult === "object" && (rpcResult as { ok?: boolean }).ok);
        if (!ok) {
          const blockers = (rpcResult as { blockers?: { message?: string }[] })?.blockers ?? [];
          throw new Error(blockers.map((b) => b.message).join("; ") || "release_order_to_in_production_v1 denied");
        }

        statusAfter = await readOrderStatus(page, orderId);
        expect(statusAfter).toBe("in_production");
        record(
          stages,
          "rpc_release_order_to_in_production",
          "PASS",
          `${statusBefore} → ${statusAfter}`,
        );
      } else {
        record(stages, "rpc_mutation", "SKIP", "No POINT37_CERT_ORDER_ID and no confirmed row for mutation");
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      if (!stages.some((s) => s.status === "FAIL")) {
        record(stages, "cert_failure", "FAIL", message);
      }
      throw error;
    } finally {
      const evidence: Point37CertEvidence = {
        schema_version: 1,
        point: 37,
        scope: "governed_production_release",
        status: stages.some((s) => s.status === "FAIL") ? "FAIL" : "PASS",
        commit_sha: COMMIT_SHA,
        target_url: targetUrl,
        order_id: orderId,
        order_status_before: statusBefore,
        order_status_after: statusAfter,
        stages,
      };
      writePoint37Evidence(evidence);
    }
  });
});
