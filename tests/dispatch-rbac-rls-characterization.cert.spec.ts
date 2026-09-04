import { test, expect, type TestInfo } from "@playwright/test";
import type { PostgrestError } from "@supabase/supabase-js";
import {
  createDispatchRlsCertClient,
  hasDispatchRlsCertBackend,
  isDispatchRlsCertRequired,
  readDispatchRlsCertCleanupCredentials,
  readDispatchRlsCertDispatchCredentials,
  resolveDispatchRlsFixtureOrderId,
  sanitizeProbeDetail,
  signInDispatchRlsCertClient,
} from "@/lib/dispatchRbacRlsCert/support";

/**
 * P0 #456 — production-backed PostgREST RLS certification for Dispatch roles.
 *
 * Requires deployed Core authority (#183 / migration release #129). Any ALLOWED
 * direct Dispatch write is a hard certification failure.
 *
 * Production lane: workflow_dispatch only — TEST_DISPATCH_EMAIL/PASSWORD probe,
 * TEST_ADMIN_EMAIL/PASSWORD cleanup, public Supabase client constants.
 * Ephemeral lane: FACTORY_CERT_* naming remains supported.
 */

type ProbeOutcome = "AUTHORIZATION_DENIED" | "ALLOWED" | "INCONCLUSIVE";

type CharacterizationRecord = {
  surface: string;
  role: string;
  operation: string;
  outcome: ProbeOutcome;
};

const PROBE_REF = "dispatch-rbac-probe";
const ledger: { records: CharacterizationRecord[] } = { records: [] };

function record(entry: CharacterizationRecord) {
  ledger.records.push(entry);
}

function requireOrSkipDispatchCredentials() {
  const credentials = readDispatchRlsCertDispatchCredentials();
  if (!credentials) {
    const message =
      "CREDENTIAL_REQUIRED: TEST_DISPATCH_EMAIL/PASSWORD or FACTORY_CERT_DISPATCH_MANAGER_*";
    if (isDispatchRlsCertRequired()) {
      throw new Error(message);
    }
    test.skip(true, message);
  }
  return credentials!;
}

function requireCleanupCredentials() {
  const credentials = readDispatchRlsCertCleanupCredentials();
  if (!credentials) {
    throw new Error(
      "CERTIFICATION_CLEANUP_REQUIRED: TEST_ADMIN_EMAIL/PASSWORD or FACTORY_CERT_SUPER_ADMIN_*/ADMIN_* required for probe residue cleanup",
    );
  }
  return credentials;
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
  });

  if (outcome === "ALLOWED") {
    throw new Error(`RLS_CERT_FAILURE: ${surface} INSERT allowed for DISPATCH_MANAGER — ${sanitizeProbeDetail(detail)}`);
  }
  if (outcome === "INCONCLUSIVE") {
    testInfo.annotations.push({
      type: "RLS_CERT_INCONCLUSIVE",
      description: `${surface}: non-authorization error`,
    });
    throw new Error(`RLS_CERT_INCONCLUSIVE: ${surface} probe could not classify authorization`);
  }
}

async function createDispatchClient() {
  const credentials = requireOrSkipDispatchCredentials();
  const client = createDispatchRlsCertClient(credentials);
  return signInDispatchRlsCertClient(client, credentials, "DISPATCH_MANAGER");
}

async function createCleanupClient() {
  const credentials = requireCleanupCredentials();
  const client = createDispatchRlsCertClient(credentials);
  return signInDispatchRlsCertClient(client, credentials, "CLEANUP");
}

async function cleanupProbeRow(
  table: "finance_review_evidence" | "inventory_reservations",
  id: string,
) {
  const cleanupClient = await createCleanupClient();
  const { data, error } = await cleanupClient.from(table).delete().eq("id", id).select("id");
  if (error) {
    throw new Error(`RLS_CERT_CLEANUP_FAILURE: ${table} delete denied — code=${error.code ?? "unknown"}`);
  }
  if (!data || data.length !== 1) {
    throw new Error(
      `RLS_CERT_CLEANUP_FAILURE: ${table} row not removed (affected=${data?.length ?? 0})`,
    );
  }
}

test.describe("Dispatch RBAC — production RLS certification", () => {
  test.skip(!hasDispatchRlsCertBackend(), "DISPATCH_RLS_CERT_BACKEND_REQUIRED");

  test.afterAll(() => {
    const denied = ledger.records.filter((entry) => entry.outcome === "AUTHORIZATION_DENIED").length;
    const allowed = ledger.records.filter((entry) => entry.outcome === "ALLOWED").length;
    const inconclusive = ledger.records.filter((entry) => entry.outcome === "INCONCLUSIVE").length;
    console.log(
      `DISPATCH_RLS_CERT_SUMMARY probes=${ledger.records.length} denied=${denied} allowed=${allowed} inconclusive=${inconclusive}`,
    );
  });

  test("DISPATCH_MANAGER direct finance_review_evidence insert is denied by deployed Core RLS", async ({ page: _page }, testInfo) => {
    const dispatchClient = await createDispatchClient();
    const cleanupCredentials = readDispatchRlsCertCleanupCredentials();
    test.skip(!cleanupCredentials, "CLEANUP_CREDENTIAL_REQUIRED: TEST_ADMIN_EMAIL/PASSWORD");

    const adminClient = await createCleanupClient();
    const orderId = await resolveDispatchRlsFixtureOrderId(adminClient);
    const actorId = (await dispatchClient.auth.getUser()).data.user?.id;
    if (!actorId) throw new Error("AUTH_REQUIRED: missing actor id");

    const correlationId = `dispatch-rbac-probe-finance-${Date.now()}`;
    const { data, error } = await dispatchClient.from("finance_review_evidence").insert({
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
      await cleanupProbeRow("finance_review_evidence", data.id);
    }

    assertProbeOutcome("finance_review_evidence", outcome, error?.message ?? "insert succeeded", testInfo);
    expect(outcome).toBe("AUTHORIZATION_DENIED");
  });

  test("DISPATCH_MANAGER direct inventory_reservations insert is denied by deployed Core RLS", async ({ page: _page }, testInfo) => {
    const dispatchClient = await createDispatchClient();
    const cleanupCredentials = readDispatchRlsCertCleanupCredentials();
    test.skip(!cleanupCredentials, "CLEANUP_CREDENTIAL_REQUIRED: TEST_ADMIN_EMAIL/PASSWORD");

    const adminClient = await createCleanupClient();
    const orderId = await resolveDispatchRlsFixtureOrderId(adminClient);
    const actorId = (await dispatchClient.auth.getUser()).data.user?.id;
    if (!actorId) throw new Error("AUTH_REQUIRED: missing actor id");

    const { data: line, error: lineError } = await adminClient
      .from("order_items")
      .select("product_id, sku")
      .eq("order_id", orderId)
      .limit(1)
      .maybeSingle();
    if (lineError) {
      throw new Error(`FIXTURE_READ_FAILED order_items: code=${lineError.code ?? "unknown"}`);
    }
    test.skip(!line?.product_id, "CERTIFICATION_FIXTURE_REQUIRED: discovered order has no order_items row");

    const reservationId = crypto.randomUUID();
    const correlationId = `dispatch-rbac-probe-reservation-${Date.now()}`;
    const { data, error } = await dispatchClient.from("inventory_reservations").insert({
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
      await cleanupProbeRow("inventory_reservations", data.id);
    }

    assertProbeOutcome("inventory_reservations", outcome, error?.message ?? "insert succeeded", testInfo);
    expect(outcome).toBe("AUTHORIZATION_DENIED");
  });
});
