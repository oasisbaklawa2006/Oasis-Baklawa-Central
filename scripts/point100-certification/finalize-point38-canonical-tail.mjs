#!/usr/bin/env node
/**
 * Point100 disposable-only final dispatch tail.
 *
 * Completes the already-governed Point38 fixture through independent Gate
 * validation -> immutable dispatch proof -> canonical dispatch finalization.
 * Synthetic scan/transport values prove software contracts only; they are not
 * physical UAT evidence. All mutations go through canonical Core authority.
 *
 * The tail certifies Core's CURRENT role-separated dispatch authority (20261001220000): the independent
 * Security Gate releases the carton (GATE_SECURITY); the Dispatch Manager records the immutable dispatch proof
 * and finalizes the order (Security does not mutate order status). It refuses to run against a Core checkout
 * that predates the separation (see scripts/factory-certification/core-authority-mode.sh), so a stale pin can
 * never silently certify obsolete authority again. Negative probes prove the separation is enforced.
 * POINT38_TAIL_STOP_BEFORE_FINALIZE=true stops after the immutable proof so a UI lane can perform the
 * Dispatch Manager finalization itself.
 */

import { createClient } from "@supabase/supabase-js";
import {
  RUN_TOKEN,
  assertLoopbackHttpOrigin,
  assertNoError,
  firstRow,
  parseCredentialFile,
  readCredential,
  requireBootstrapEnv,
} from "./point38-bootstrap-common.mjs";

const LOCAL_LABEL = "POINT100_POINT38_TAIL";
const values = parseCredentialFile();

function credentialValue(name) {
  return readCredential(values, name, LOCAL_LABEL);
}

function roleCredentials(role) {
  const canonical = role.trim().toUpperCase();
  return {
    email: credentialValue(`FACTORY_CERT_${canonical}_EMAIL`),
    password: credentialValue(`FACTORY_CERT_${canonical}_PASSWORD`),
  };
}

const backendUrl = assertLoopbackHttpOrigin(requireBootstrapEnv("FACTORY_CERT_SUPABASE_URL", LOCAL_LABEL), LOCAL_LABEL);
const anonKey = requireBootstrapEnv("FACTORY_CERT_SUPABASE_ANON_KEY", LOCAL_LABEL);
const point38OrderId = credentialValue("FACTORY_CERT_POINT38_ORDER_ID");

function newClient() {
  return createClient(backendUrl, anonKey, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  });
}

async function authenticatedRole(role) {
  const creds = roleCredentials(role);
  const client = newClient();
  const { error: signInError } = await client.auth.signInWithPassword({ email: creds.email, password: creds.password });
  assertNoError(signInError, `Point38 tail ${role} sign-in`);
  const { data: userData, error: userError } = await client.auth.getUser();
  assertNoError(userError, `Point38 tail ${role} auth user`);
  const actorId = userData.user?.id;
  if (!actorId) throw new Error(`POINT100_POINT38_TAIL_ACTOR_REQUIRED: ${role}`);
  return { client, actorId };
}

const dispatchRole = await authenticatedRole("DISPATCH_MANAGER");
const gateRole = await authenticatedRole("GATE_SECURITY");

const authorityMode = process.env.POINT38_CORE_AUTHORITY_MODE?.trim() ?? "";
if (authorityMode !== "role-separated") {
  throw new Error(
    `POINT100_POINT38_TAIL_REQUIRES_ROLE_SEPARATED_CORE: POINT38_CORE_AUTHORITY_MODE must be 'role-separated' (got '${authorityMode || "unset"}'); the Core checkout under test must contain 20261001220000_gate_dispatch_role_separation.sql (see scripts/factory-certification/core-authority-mode.sh)`,
  );
}
// Proof recording and finalization belong to Dispatch; the Gate only releases the carton.
const proofRole = dispatchRole;
const stopBeforeFinalize = process.env.POINT38_TAIL_STOP_BEFORE_FINALIZE === "true";
console.log("Point100 Point38 tail authority mode: gate/dispatch role-separated (Core >= 20261001220000)");

/**
 * Negative authorization assertion: the call must be REJECTED for the stated reason, so the lane fails if Core's
 * separation of duties is ever loosened (or if a role were silently interchangeable). Core's role matrix
 * (20261001220000) is the documented contract. A rejected call must not mutate state.
 */
async function expectRejected(label, call, expectedFragment) {
  const { data, error } = await call();
  const message = String(error?.message ?? "");
  if (!error || !message.includes(expectedFragment)) {
    throw new Error(
      `POINT38_NEGATIVE_AUTHORIZATION_FAILED: ${label}: expected rejection containing "${expectedFragment}", got ${JSON.stringify({ error: error?.message ?? null, data })}`,
    );
  }
  console.log(`Point38 negative authorization PASS: ${label} -> rejected ("${expectedFragment}")`);
}

try {
  const { data: consignments, error: consignmentError } = await dispatchRole.client
    .from("b2b_dispatch_consignments")
    .select("id")
    .eq("order_id", point38OrderId)
    .order("created_at", { ascending: false })
    .limit(1);
  assertNoError(consignmentError, "Point38 tail consignment lookup");
  const consignmentId = String(consignments?.[0]?.id ?? "");
  if (!consignmentId) throw new Error("POINT100_POINT38_TAIL_CONSIGNMENT_MISSING");

  const { data: cartons, error: cartonError } = await dispatchRole.client
    .from("b2b_dispatch_cartons")
    .select("id,carton_code,current_version,status")
    .eq("consignment_id", consignmentId)
    .order("created_at", { ascending: false })
    .limit(1);
  assertNoError(cartonError, "Point38 tail carton lookup");
  const cartonId = String(cartons?.[0]?.id ?? "");
  const cartonCode = String(cartons?.[0]?.carton_code ?? "").trim();
  if (!cartonId || !cartonCode) throw new Error("POINT100_POINT38_TAIL_CARTON_MISSING");

  const gateScanCorrelation = `${RUN_TOKEN}:synthetic-gate-scan`;
  const { data: priorScan, error: priorScanError } = await gateRole.client
    .from("operational_scan_records")
    .select("id")
    .eq("correlation_id", gateScanCorrelation)
    .maybeSingle();
  assertNoError(priorScanError, "Point38 tail prior gate scan lookup");

  let gateScanId = String(priorScan?.id ?? "");
  if (!gateScanId) {
    const { data: gateScan, error: gateScanError } = await gateRole.client
      .from("operational_scan_records")
      .insert({
        scan_type: "dispatch_gate",
        verification_type: "gate_check",
        entity_type: "dispatch_carton",
        entity_id: cartonId,
        order_id: point38OrderId,
        barcode_value: cartonCode,
        expected_barcode: cartonCode,
        verification_status: "scanned",
        scan_source: "point100_disposable_synthetic_gate",
        actor_id: gateRole.actorId,
        actor_role: "GATE_SECURITY",
        correlation_id: gateScanCorrelation,
        metadata: { certification_mode: "disposable_synthetic", physical_uat: false },
      })
      .select("id")
      .single();
    assertNoError(gateScanError, "Point38 tail synthetic gate scan");
    gateScanId = String(gateScan?.id ?? "");
  }
  if (!gateScanId) throw new Error("POINT100_POINT38_TAIL_GATE_SCAN_ID_MISSING");

  // #366 closed the historical locked -> ready_to_load authority gap.
  // Use the canonical authenticated Core RPC; Point100 must never manufacture
  // gate-ready carton state with direct SQL.
  const currentVersion = Number(cartons?.[0]?.current_version);
  if (!Number.isInteger(currentVersion)) {
    throw new Error("POINT100_POINT38_TAIL_CARTON_VERSION_MISSING");
  }
  const readyCorrelation = `${RUN_TOKEN}:carton-ready-to-load`;
  const { data: readyCarton, error: readyError } = await dispatchRole.client.rpc(
    "mark_b2b_dispatch_carton_ready_to_load_v1",
    {
      p_carton_id: cartonId,
      p_expected_version: currentVersion,
      p_correlation_id: readyCorrelation,
    },
  );
  assertNoError(readyError, "Point38 tail governed carton ready-to-load transition");
  if (!["ready_to_load", "loaded", "handed_over"].includes(String(readyCarton?.status ?? ""))) {
    throw new Error(
      `POINT100_POINT38_TAIL_CARTON_NOT_GATE_READY: status=${String(readyCarton?.status ?? "unknown")}`,
    );
  }

  await expectRejected(
    "DISPATCH_MANAGER must not perform the independent Security Gate release",
    () => dispatchRole.client.rpc("release_b2b_dispatch_carton_at_gate_v1", { p_carton_id: cartonId, p_scan_evidence_id: gateScanId }),
    "independent security gate authority required",
  );

  const { data: gateDecisionData, error: gateDecisionError } = await gateRole.client.rpc("release_b2b_dispatch_carton_at_gate_v1", {
    p_carton_id: cartonId,
    p_scan_evidence_id: gateScanId,
  });
  assertNoError(gateDecisionError, "Point38 tail gate release");
  const gateDecision = firstRow(gateDecisionData) ?? gateDecisionData;
  if (gateDecision?.ok !== true) {
    throw new Error(`POINT100_POINT38_TAIL_GATE_BLOCKED: ${JSON.stringify(gateDecision?.blockers ?? gateDecision)}`);
  }

  const { error: verifyScanError } = await gateRole.client
    .from("operational_scan_records")
    .update({ verification_status: "verified" })
    .eq("id", gateScanId);
  assertNoError(verifyScanError, "Point38 tail gate evidence verification");

  await expectRejected(
    "GATE_SECURITY must not record the dispatch proof (Dispatch-owned)",
    () =>
      gateRole.client.rpc("record_dispatch_proof_packet_v1", {
        p_order_id: point38OrderId,
        p_transport_snapshot: { transporter: "UNAUTHORIZED PROBE" },
        p_evidence_references: ["point38:negative-authorization-probe"],
        p_dispatched_at: new Date().toISOString(),
        p_correlation_id: `${RUN_TOKEN}:negative-proof-probe`,
        p_idempotency_key: `${RUN_TOKEN}:negative-proof-probe`,
        p_actor_id: gateRole.actorId,
      }),
    "dispatch proof authority required",
  );

  const dispatchedAt = new Date().toISOString();
  const trackingReference = "P100-TRK-POINT38-CANONICAL";
  const proofIdentity = `${RUN_TOKEN}:dispatch-proof`;
  const { data: proofData, error: proofError } = await proofRole.client.rpc("record_dispatch_proof_packet_v1", {
    p_order_id: point38OrderId,
    p_transport_snapshot: {
      transporter: "POINT100 SYNTHETIC CARRIER",
      transport_mode: "ROAD",
      lr_awb_bilty: "P100-LR-POINT38-CANONICAL",
      vehicle_number: "DL01P1000",
      driver_name: "Point100 Synthetic Driver",
      driver_phone: "9999999999",
      tracking_reference: trackingReference,
    },
    p_evidence_references: ["point100:disposable-synthetic:gate:point38"],
    p_dispatched_at: dispatchedAt,
    p_correlation_id: proofIdentity,
    p_idempotency_key: proofIdentity,
    p_actor_id: proofRole.actorId,
  });
  assertNoError(proofError, "Point38 tail immutable dispatch proof");
  const dispatchProofId = String(firstRow(proofData)?.dispatch_proof_id ?? "");
  if (!dispatchProofId) throw new Error("POINT100_POINT38_TAIL_DISPATCH_PROOF_ID_MISSING");

  await expectRejected(
    "GATE_SECURITY must not finalize dispatch (Security does not mutate order status)",
    () =>
      gateRole.client.rpc("release_order_to_dispatched_v1", {
        p_order_id: point38OrderId,
        p_tracking_number: trackingReference,
        p_courier_name: "POINT100 SYNTHETIC CARRIER",
        p_finalize_reason: "negative authorization probe",
        p_correlation_id: `${RUN_TOKEN}:negative-finalize-probe`,
      }),
    "dispatch finalization authority required",
  );
  // The rejected finalize must not have changed the order: it is still cleared_for_dispatch.
  const { data: afterProbe, error: afterProbeError } = await dispatchRole.client
    .from("orders")
    .select("status")
    .eq("id", point38OrderId)
    .maybeSingle();
  assertNoError(afterProbeError, "Point38 tail post-probe order status read");
  if (String(afterProbe?.status ?? "").toLowerCase() !== "cleared_for_dispatch") {
    throw new Error(`POINT38_NEGATIVE_AUTHORIZATION_MUTATED_STATE: order status is ${String(afterProbe?.status)}`);
  }

  if (stopBeforeFinalize) {
    console.log(
      "Point38 tail stopped before finalization by request: Gate decision and immutable dispatch proof exist; the Dispatch Manager finalizes.",
    );
    await Promise.allSettled([dispatchRole.client.auth.signOut(), gateRole.client.auth.signOut()]);
    process.exit(0);
  }

  const { data: finalizeData, error: finalizeError } = await proofRole.client.rpc("release_order_to_dispatched_v1", {
    p_order_id: point38OrderId,
    p_tracking_number: trackingReference,
    p_courier_name: "POINT100 SYNTHETIC CARRIER",
    p_finalize_reason: "Point100 disposable software rehearsal finalization",
    p_correlation_id: `${RUN_TOKEN}:dispatch-finalize`,
  });
  assertNoError(finalizeError, "Point38 tail canonical dispatch finalization");
  const finalize = firstRow(finalizeData) ?? finalizeData;
  if (finalize?.ok !== true || finalize?.new_status !== "dispatched") {
    throw new Error(`POINT100_POINT38_TAIL_FINALIZE_BLOCKED: ${JSON.stringify(finalize)}`);
  }

  const { data: exitFactsData, error: exitFactsError } = await proofRole.client.rpc("get_finance_exit_facts_v1", {
    p_order_id: point38OrderId,
  });
  assertNoError(exitFactsError, "Point38 tail final finance-exit verification");
  const exitFacts = firstRow(exitFactsData);
  if (
    !exitFacts ||
    exitFacts.order_status !== "dispatched" ||
    String(exitFacts.dispatch_proof_id ?? "") !== dispatchProofId ||
    exitFacts.dispatch_cleared !== true ||
    exitFacts.complaint_clock_basis !== "FINAL_INVOICE_DATE" ||
    typeof exitFacts.complaint_window_open !== "boolean"
  ) {
    throw new Error(`POINT100_POINT38_TAIL_FINAL_FACTS_INVALID: ${JSON.stringify(exitFacts)}`);
  }

  console.log("Point100 Point38 canonical Gate -> dispatch proof -> finalization tail prepared on disposable Core authority.");
} finally {
  await Promise.allSettled([
    dispatchRole.client.auth.signOut(),
    gateRole.client.auth.signOut(),
  ]);
}
