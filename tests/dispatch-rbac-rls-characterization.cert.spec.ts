import { test, expect, type TestInfo } from "@playwright/test";
import { createClient, type PostgrestError } from "@supabase/supabase-js";
import type { Database } from "../src/integrations/supabase/types";
import { factoryCertificationCredentialSpec } from "../src/lib/factoryCertificationCredentialPolicy";
import {
  hasFactoryCertificationBackend,
  readFactoryCertificationCredentials,
  resolveFactoryCertificationBackend,
} from "./factory-certification/support";

/**
 * P0 #456 — production-backed PostgREST RLS certification for Dispatch roles.
 *
 * Requires deployed Core authority (#183 / migration release #129). Any ALLOWED
 * direct Dispatch write is a hard certification failure.
 */

type ProbeOutcome = "AUTHORIZATION_DENIED" | "ALLOWED" | "INCONCLUSIVE";

type CharacterizationRecord = {
  surface: string;
  role: string;
  operation: string;
  outcome: ProbeOutcome;
  detail: string;
};

const PROBE_REF = "dispatch-rbac-probe";
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

function classifyInsertError(error: PostgrestError | null): ProbeOutcome {
  if (!error) return "ALLOWED";
  const code = error.code ?? "";
  const message = error.message.toLowerCase();
  const details = (error.details ?? "").toLowerCase();

  if (
    code === "42501" ||
    message.includes("permission denied") ||
    message.includes("row-level security") ||
    message.includes("row level security") ||
    message.includes("policy") ||
    details.includes("policy")
  ) {
    return "AUTHORIZATION_DENIED";
  }

  if (
    code === "23503" ||
    code === "23502" ||
    code === "23514" ||
    code === "42703" ||
    code === "42P01" ||
    message.includes("foreign key") ||
    message.includes("violates") ||
    message.includes("does not exist") ||
    message.includes("column")
  ) {
    return "INCONCLUSIVE";
  }

  return "INCONCLUSIVE";
}

function assertProbeOutcome(
  surface: string,
  outcome: ProbeOutcome,
  detail: string,
  testInfo: TestInfo,
) {
  record({
    surface,
    role: "DISPATCH_MANAGER",
    operation: "insert",
    outcome,
    detail,
  });

  if (outcome === "ALLOWED") {
    throw new Error(`RLS_CERT_FAILURE: ${surface} INSERT allowed for DISPATCH_MANAGER — ${detail}`);
  }
  if (outcome === "INCONCLUSIVE") {
    testInfo.annotations.push({
      type: "RLS_CERT_INCONCLUSIVE",
      description: `${surface}: non-authorization error — ${detail}`,
    });
    throw new Error(`RLS_CERT_INCONCLUSIVE: ${surface} probe could not classify authorization — ${detail}`);
  }
}

async function createDispatchClient() {
  const credentials = credentialsForRoleOrSkip("DISPATCH_MANAGER");
  const backend = resolveFactoryCertificationBackend();
  const client = createClient<Database>(backend.url, backend.anonKey, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  });
  const { error } = await client.auth.signInWithPassword({
    email: credentials.email,
    password: credentials.password,
  });
  if (error) throw new Error(`AUTH_FAILED DISPATCH_MANAGER: ${error.message}`);
  return client;
}

function resolveFixtureOrderId(): string {
  const orderId =
    process.env.FACTORY_CERT_POINT38_ORDER_ID?.trim() ||
    process.env.FACTORY_CERT_GOLDEN_ORDER_ID?.trim() ||
    process.env.FACTORY_CERT_POINT37_ORDER_ID?.trim();
  if (!orderId) {
    throw new Error(
      "CERTIFICATION_FIXTURE_REQUIRED: FACTORY_CERT_POINT38_ORDER_ID, FACTORY_CERT_GOLDEN_ORDER_ID, or FACTORY_CERT_POINT37_ORDER_ID",
    );
  }
  return orderId;
}

test.describe("Dispatch RBAC — production RLS certification", () => {
  test.skip(!hasFactoryCertificationBackend(), "FACTORY_CERT_BACKEND_REQUIRED");

  test.afterAll(() => {
    if (ledger.records.length > 0) {
      console.log("DISPATCH_RLS_CHARACTERIZATION", JSON.stringify(ledger, null, 2));
    }
  });

  test("DISPATCH_MANAGER direct finance_review_evidence insert is denied by deployed Core RLS", async ({ page: _page }, testInfo) => {
    const client = await createDispatchClient();
    const orderId = resolveFixtureOrderId();
    const actorId = (await client.auth.getUser()).data.user?.id;
    if (!actorId) throw new Error("AUTH_REQUIRED: missing actor id");

    const correlationId = `dispatch-rbac-probe-finance-${Date.now()}`;
    const { data, error } = await client.from("finance_review_evidence").insert({
      order_id: orderId,
      review_type: "credit_review",
      review_status: "pending",
      evidence_type: "credit_review",
      evidence_ref: PROBE_REF,
      actor_id: actorId,
      actor_role: "DISPATCH_MANAGER",
      correlation_id: correlationId,
    }).select("id").maybeSingle();

    const outcome = classifyInsertError(error);
    if (outcome === "ALLOWED" && data?.id) {
      await client.from("finance_review_evidence").delete().eq("id", data.id);
    }

    assertProbeOutcome("finance_review_evidence", outcome, error?.message ?? "insert succeeded", testInfo);
    expect(outcome).toBe("AUTHORIZATION_DENIED");
  });

  test("DISPATCH_MANAGER direct inventory_reservations insert is denied by deployed Core RLS", async ({ page: _page }, testInfo) => {
    const client = await createDispatchClient();
    const orderId = resolveFixtureOrderId();
    const actorId = (await client.auth.getUser()).data.user?.id;
    if (!actorId) throw new Error("AUTH_REQUIRED: missing actor id");

    const { data: line, error: lineError } = await client
      .from("order_items")
      .select("product_id, sku")
      .eq("order_id", orderId)
      .limit(1)
      .maybeSingle();
    if (lineError) throw new Error(`FIXTURE_READ_FAILED order_items: ${lineError.message}`);
    test.skip(!line?.product_id, `CERTIFICATION_FIXTURE_REQUIRED: order ${orderId} has no order_items row`);

    const reservationId = crypto.randomUUID();
    const correlationId = `dispatch-rbac-probe-reservation-${Date.now()}`;
    const { data, error } = await client.from("inventory_reservations").insert({
      id: reservationId,
      reservation_number: `RBAC-PROBE-${Date.now()}`,
      order_id: orderId,
      product_id: line.product_id,
      sku: line.sku ?? "RBAC-PROBE",
      requested_qty: 1,
      reserved_qty: 0,
      fulfilled_qty: 0,
      released_qty: 0,
      reservation_status: "pending",
      reservation_priority: "normal",
      reserved_by: actorId,
      correlation_id: correlationId,
      version: 1,
    }).select("id").maybeSingle();

    const outcome = classifyInsertError(error);
    if (outcome === "ALLOWED" && data?.id) {
      await client.from("inventory_reservations").delete().eq("id", data.id);
    }

    assertProbeOutcome("inventory_reservations", outcome, error?.message ?? "insert succeeded", testInfo);
    expect(outcome).toBe("AUTHORIZATION_DENIED");
  });
});
