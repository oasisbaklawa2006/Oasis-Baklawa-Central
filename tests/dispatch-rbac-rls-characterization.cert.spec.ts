import { test, expect } from "@playwright/test";
import { createClient } from "@supabase/supabase-js";
import { factoryCertificationCredentialSpec } from "../src/lib/factoryCertificationCredentialPolicy";
import {
  hasFactoryCertificationBackend,
  readFactoryCertificationCredentials,
  resolveFactoryCertificationBackend,
} from "./factory-certification/support";

/**
 * P0 #456 — characterize disposable/staging PostgREST RLS for Dispatch roles.
 *
 * Central's governed write path (financeGovernanceService + reservationRepository)
 * fail-closes before persistence. This cert records whether raw table RLS also
 * denies Dispatch or only `is_internal_staff` (documented Core companion lane).
 *
 * Skips when Factory certification credentials/backend are unavailable.
 * Does not fail CI when RLS is broader — records CORE_RLS_GAP for Mission Control.
 */

type CharacterizationRecord = {
  surface: string;
  role: string;
  operation: string;
  outcome: "DENIED" | "ALLOWED";
  detail: string;
};

const ledger: { records: CharacterizationRecord[] } = { records: [] };

function record(entry: CharacterizationRecord) {
  ledger.records.push(entry);
}

function credentialsForRoleOrSkip(role: string) {
  const spec = factoryCertificationCredentialSpec(role);
  const credentials = readFactoryCertificationCredentials(role);
  test.skip(!credentials, `CREDENTIAL_REQUIRED: ${spec.emailEnv} + ${spec.passwordEnv}`);
  return credentials!;
}

async function createDispatchClient() {
  const credentials = credentialsForRoleOrSkip("DISPATCH_MANAGER");
  const backend = resolveFactoryCertificationBackend();
  const client = createClient(backend.url, backend.anonKey, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  });
  const { error } = await client.auth.signInWithPassword({
    email: credentials.email,
    password: credentials.password,
  });
  if (error) throw new Error(`AUTH_FAILED DISPATCH_MANAGER: ${error.message}`);
  return client;
}

test.describe("Dispatch RBAC — disposable RLS characterization", () => {
  test.skip(!hasFactoryCertificationBackend(), "FACTORY_CERT_BACKEND_REQUIRED");

  test.afterAll(() => {
    if (ledger.records.length > 0) {
      console.log("DISPATCH_RLS_CHARACTERIZATION", JSON.stringify(ledger, null, 2));
    }
  });

  test("DISPATCH_MANAGER direct finance_review_evidence insert is characterized", async ({ page: _page }, testInfo) => {
    const client = await createDispatchClient();
    const orderId = "00000000-0000-4000-8000-00000000f1";
    const { error } = await client.from("finance_review_evidence").insert({
      order_id: orderId,
      review_type: "credit_review",
      review_status: "pending",
      evidence_type: "credit_review",
      evidence_ref: "dispatch-rbac-probe",
      actor_id: (await client.auth.getUser()).data.user?.id,
      actor_role: "DISPATCH_MANAGER",
      correlation_id: `dispatch-rbac-probe-finance-${Date.now()}`,
    });

    record({
      surface: "finance_review_evidence",
      role: "DISPATCH_MANAGER",
      operation: "insert",
      outcome: error ? "DENIED" : "ALLOWED",
      detail: error?.message ?? "insert succeeded",
    });

    if (!error) {
      await client.from("finance_review_evidence").delete().eq("order_id", orderId).eq("evidence_ref", "dispatch-rbac-probe");
      testInfo.annotations.push({
        type: "CORE_RLS_GAP",
        description:
          "finance_review_evidence INSERT allowed for DISPATCH_MANAGER via is_internal_staff — Core role-scoped deny policy required",
      });
    }

    expect(ledger.records.at(-1)?.surface).toBe("finance_review_evidence");
  });

  test("DISPATCH_MANAGER direct inventory_reservations insert is characterized", async ({ page: _page }, testInfo) => {
    const client = await createDispatchClient();
    const reservationId = crypto.randomUUID();
    const { error } = await client.from("inventory_reservations").insert({
      id: reservationId,
      reservation_number: `RBAC-PROBE-${Date.now()}`,
      order_id: "00000000-0000-4000-8000-00000000f2",
      product_id: "00000000-0000-4000-8000-000000000020",
      sku: "RBAC-PROBE",
      requested_qty: 1,
      reserved_qty: 0,
      fulfilled_qty: 0,
      released_qty: 0,
      reservation_status: "pending",
      reservation_priority: "normal",
      reserved_by: (await client.auth.getUser()).data.user?.id,
      correlation_id: `dispatch-rbac-probe-reservation-${Date.now()}`,
      version: 1,
    });

    record({
      surface: "inventory_reservations",
      role: "DISPATCH_MANAGER",
      operation: "insert",
      outcome: error ? "DENIED" : "ALLOWED",
      detail: error?.message ?? "insert succeeded",
    });

    if (!error) {
      await client.from("inventory_reservations").delete().eq("id", reservationId);
      testInfo.annotations.push({
        type: "CORE_RLS_GAP",
        description:
          "inventory_reservations INSERT allowed for DISPATCH_MANAGER via is_internal_staff — Core role-scoped deny policy required",
      });
    }

    expect(ledger.records.at(-1)?.surface).toBe("inventory_reservations");
  });
});
