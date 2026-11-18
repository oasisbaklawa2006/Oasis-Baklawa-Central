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
/**
 * STRICTLY a disposable loopback fixture for one already-deployed, pre-507
 * production-certified Core pin. This is NOT an application fallback and
 * NEVER applies to Core #507 or other Core revisions. When the official
 * Point100 production pin advances, the governed Core RPC is mandatory.
 */
const legacyPinnedSyntheticGateFixture =
  process.env.POINT100_CORE_VERIFIED_SHA === "645899439fe0a84806238b9114649eb2c3785a75" &&
  process.env.POINT100_DISPATCH_PRODUCTION_VERIFIED === "true";

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

  // Core #507's governed writer is mandatory for every Core revision except
  // the single proven pre-507 production pin used by the OLD disposable rehearsal.
  // All paths use loopback-only Supabase and the independent Gate staff actor.
  const gateScanCorrelation = `${RUN_TOKEN}:synthetic-gate-scan`;
  let gateScanId = "";
  if (legacyPinnedSyntheticGateFixture) {
    console.log("POINT100_PRE507_LEGACY_FIXTURE_ONLY: production-certified Core 6458994; NOT Core #507 acceptance");
    const { data: priorScan, error: priorScanError } = await gateRole.client
      .from("operational_scan_records")
      .select("id")
      .eq("correlation_id", gateScanCorrelation)
      .maybeSingle();
    assertNoError(priorScanError, "Point38 pre-507 prior fixture lookup");
    gateScanId = String(priorScan?.id ?? "");
    if (!gateScanId) {
      const { data: legacyScan, error: legacyScanError } = await gateRole.client
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
          metadata: { certification_mode: "disposable_synthetic_pre507_only", physical_uat: false },
        })
        .select("id")
        .single();
      assertNoError(legacyScanError, "Point38 pre-507 synthetic fixture scan");
      gateScanId = String(legacyScan?.id ?? "");
    }
    if (!gateScanId) throw new Error("POINT100_POINT38_TAIL_LEGACY_GATE_SCAN_ID_MISSING");
  } else {
    // Replays retain server-issued scan ID, with full active Gate-staff
    // authorization, carton provenance and append-only evidence.
    const { data: gateScan, error: gateScanError } = await gateRole.client.rpc("record_b2b_dispatch_gate_scan_v1", {
      p_carton_id: cartonId,
      p_scanned_barcode: cartonCode,
      p_idempotency_key: gateScanCorrelation,
    });
    assertNoError(gateScanError, "Point38 tail governed gate scan");
    gateScanId = String(gateScan?.scan_id ?? "");
    if (gateScan?.ok !== true || gateScan?.carton_id !== cartonId || !gateScanId) {
      throw new Error("POINT100_POINT38_TAIL_GOVERNED_GATE_SCAN_INVALID");
    }
  }

  // Finance stays independent too: neither Dispatch nor the Security Gate may issue Finance documents or decide
  // Finance clearance. Core checks the Finance actor first, before any argument or state validation, so dummy
  // identifiers are sufficient and nothing can be written when the call is correctly rejected.
  const probeUuid = "00000000-0000-4000-8000-0000000000a1";
  await expectRejected(
    "DISPATCH_MANAGER must not issue a final invoice (Finance-owned)",
    () =>
      dispatchRole.client.rpc("issue_final_invoice_v1", {
        p_order_id: point38OrderId,
        p_pi_id: probeUuid,
        p_commercial_version_id: probeUuid,
        p_finance_dpl_receipt_id: probeUuid,
        p_invoice_number: "NEG-AUTH-PROBE",
        p_invoice_date: "2026-01-01",
        p_document_reference: "point38:negative-authorization-probe",
        p_reason: "negative authorization probe",
        p_correlation_id: `${RUN_TOKEN}:negative-invoice-probe`,
        p_idempotency_key: `${RUN_TOKEN}:negative-invoice-probe`,
        p_actor_id: dispatchRole.actorId,
      }),
    "finance authority required",
  );
  await expectRejected(
    "GATE_SECURITY must not decide Finance dispatch clearance (Finance-owned)",
    () =>
      gateRole.client.rpc("decide_finance_dispatch_clearance_v1", {
        p_final_invoice_id: probeUuid,
        p_decision: "GRANTED",
        p_reason: "negative authorization probe",
        p_evidence_reference: "point38:negative-authorization-probe",
        p_correlation_id: `${RUN_TOKEN}:negative-clearance-probe`,
        p_idempotency_key: `${RUN_TOKEN}:negative-clearance-probe`,
        p_actor_id: gateRole.actorId,
      }),
    "finance authority required",
  );

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

  if (legacyPinnedSyntheticGateFixture) {
    // ONLY the explicitly pinned pre-507 disposable fixture expects a legacy
    // scan-verification update. Never execute for the governed Core #507 path.
    const { error: verifyLegacyScanError } = await gateRole.client
      .from("operational_scan_records")
      .update({ verification_status: "verified" })
      .eq("id", gateScanId);
    assertNoError(verifyLegacyScanError, "Point38 pre-507 fixture scan verification");
  }
  // Core #507 evidence remains append-only; its gate-decision row is the truth.

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
