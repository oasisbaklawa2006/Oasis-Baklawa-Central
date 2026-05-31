import type { SupabaseClient } from "@supabase/supabase-js";
import type { ExecutionReadModelResult } from "../types";
import { buildReadModelMeta, emptyReadModelResult } from "../types";
import { deriveFinanceSignalFromSlices } from "../adapters/financeSignalAdapter";
import { deriveSignalMeta } from "../signalStale";
import { deriveReadinessInputFromSlices } from "../adapters/readinessSignalAdapter";
import { deriveCompletionInputFromSlices } from "../adapters/completionSignalAdapter";
import { deriveFinalizationInputFromSlices } from "../adapters/finalizationSignalAdapter";
import { deriveStockInputFromSlices } from "../adapters/stockSignalAdapter";
import { shouldShowOrderAsStockFinalizationCandidate } from "@/lib/golden-chain-operator/goldenChainStockFilters";
import {
  deriveCompletionStatusFromEvidence,
  deriveFinanceReleaseStatusFromInput,
  deriveReadinessStatusFromEvidence,
  financeSignalForFinalization,
  isGateEligibleFromReadinessEvidence,
  resolveCompletionReferenceFromEvidence,
  resolveGateReferenceFromSlices,
  resolveTransporterReference,
} from "../adapters/governanceEvidenceFusion";
import type { FinanceGovernanceInput } from "@/lib/finance-governance/financeGovernanceTypes";
import type { DispatchReadinessInput } from "@/lib/dispatch-readiness/dispatchReadinessTypes";
import type { DispatchCompletionInput } from "@/lib/dispatch-completion/dispatchCompletionTypes";
import type { DispatchFinalizationInput } from "@/lib/dispatch-finalization/dispatchFinalizationTypes";
import type { StockFinalizationInput } from "@/lib/stock-finalization/stockFinalizationTypes";
import type { StockReservationRecord } from "@/lib/stock-finalization/stockReservationTypes";
import type { FinanceReleaseStatus } from "@/lib/finance-governance/financeGovernanceTypes";
import type { DerivedSignalMeta } from "../types";
import type { DispatchReadinessStatus } from "@/lib/dispatch-readiness/dispatchReadinessTypes";
import type { DispatchCompletionStatus } from "@/lib/dispatch-completion/dispatchCompletionTypes";
import type { DispatchReleaseStatus } from "@/lib/dispatch-finalization/dispatchFinalizationTypes";
import type { ReservationReadinessStatus } from "@/lib/dispatch-readiness/dispatchReadinessTypes";

const DISPATCH_PIPELINE_STATUSES = [
  "cleared_for_dispatch",
  "packed_ready",
  "awaiting_final_payment",
  "ready_for_dispatch",
  "in_production",
  "manufacturing",
  "dispatched",
] as const;

const ORDER_SELECT =
  "id, status, sales_order_value, advance_required, advance_paid, payment_status, created_at";

export interface GovernanceBoardRow<TInput> {
  input: TInput;
  missingSignals: string[];
  /** Populated when finance fusion ran for this order */
  financeSignal?: import("@/lib/dispatch-readiness/financeDispatchSignal").FinanceDispatchSignal;
  financeSignalMeta?: DerivedSignalMeta;
}

async function probeTable(client: SupabaseClient, table: string): Promise<boolean> {
  const { error } = await client.from(table).select("id").limit(1);
  return !error;
}

export function scanSliceFromRecords(
  records: { verification_status: string; scan_type: string; created_at: string }[],
): {
  hasUnresolvedMismatch: boolean;
  hasRejectedGateScan: boolean;
  gateScanVerified: boolean;
  cartonBarcodeVerified: boolean;
  latestAt: string | null;
} {
  const gate = records.filter((r) => r.scan_type === "dispatch_gate");
  const carton = records.filter((r) => r.scan_type === "carton");
  const latestAt = records[0]?.created_at ?? null;
  return {
    hasUnresolvedMismatch: records.some((r) => r.verification_status === "mismatch"),
    hasRejectedGateScan: gate.some((r) => r.verification_status === "rejected"),
    gateScanVerified: gate.some((r) => r.verification_status === "verified"),
    cartonBarcodeVerified: carton.some((r) => r.verification_status === "verified"),
    latestAt,
  };
}

export async function loadFinanceGovernanceRows(
  client: SupabaseClient,
  limit = 12,
): Promise<ExecutionReadModelResult<GovernanceBoardRow<FinanceGovernanceInput>>> {
  const tables = ["orders", "finance_review_evidence"];
  const financeOk = await probeTable(client, "finance_review_evidence");
  if (!financeOk) {
    return emptyReadModelResult("unavailable", tables, ["finance_review_evidence_table"]);
  }

  const { data: orders, error } = await client
    .from("orders")
    .select(ORDER_SELECT)
    .in("status", [...DISPATCH_PIPELINE_STATUSES])
    .eq("is_waste", false)
    .order("created_at", { ascending: false })
    .limit(limit);

  if (error) {
    return emptyReadModelResult("unavailable", tables, [error.message]);
  }

  const orderIds = (orders ?? []).map((o) => o.id as string);
  if (orderIds.length === 0) {
    return {
      rows: [],
      meta: buildReadModelMeta({ projectionSource: "empty", derivedFromTables: tables }),
    };
  }

  const readinessEvidenceOk = await probeTable(client, "dispatch_readiness_evidence");

  const [{ data: evidence }, { data: readinessEvidence }] = await Promise.all([
    client
      .from("finance_review_evidence")
      .select("order_id, review_status, review_type, created_at")
      .in("order_id", orderIds)
      .order("created_at", { ascending: false }),
    readinessEvidenceOk
      ? client
          .from("dispatch_readiness_evidence")
          .select("order_id, evidence_type, evidence_status, created_at")
          .in("order_id", orderIds)
          .order("created_at", { ascending: false })
      : Promise.resolve({ data: [] as { order_id: string; evidence_type: string; evidence_status: string; created_at: string }[] }),
  ]);

  const readinessByOrder = new Map<string, { evidence_type: string; evidence_status: string; created_at: string }[]>();
  for (const row of readinessEvidence ?? []) {
    const oid = row.order_id as string;
    const list = readinessByOrder.get(oid) ?? [];
    list.push({
      evidence_type: row.evidence_type as string,
      evidence_status: row.evidence_status as string,
      created_at: row.created_at as string,
    });
    readinessByOrder.set(oid, list);
  }

  const evidenceByOrder = new Map<string, { review_status: string; review_type: string; created_at: string }[]>();
  for (const row of evidence ?? []) {
    const oid = row.order_id as string;
    const list = evidenceByOrder.get(oid) ?? [];
    list.push({
      review_status: row.review_status as string,
      review_type: row.review_type as string,
      created_at: row.created_at as string,
    });
    evidenceByOrder.set(oid, list);
  }

  const rows: GovernanceBoardRow<FinanceGovernanceInput>[] = [];
  const allMissing = new Set<string>();

  for (const o of orders ?? []) {
    const oid = o.id as string;
    const readinessSlices = (readinessByOrder.get(oid) ?? []).map((e) => ({
      evidenceType: e.evidence_type,
      evidenceStatus: e.evidence_status,
      createdAt: e.created_at,
    }));
    const fusion = deriveFinanceSignalFromSlices(
      {
        orderId: oid,
        orderValue: Number(o.sales_order_value ?? 0),
        advanceRequired: Number(o.advance_required ?? 0),
        advanceVerified: Number(o.advance_paid ?? 0) >= Number(o.advance_required ?? 0),
        paymentStatus: (o.payment_status as string) ?? null,
        updatedAt: (o.created_at as string) ?? null,
      },
      (evidenceByOrder.get(oid) ?? []).map((e) => ({
        reviewStatus: e.review_status,
        reviewType: e.review_type,
        createdAt: e.created_at,
      })),
      { dispatchReadinessGateEligible: isGateEligibleFromReadinessEvidence(readinessSlices) },
    );
    fusion.missingSignals.forEach((m) => allMissing.add(m));
    rows.push({
      input: fusion.input,
      missingSignals: fusion.missingSignals,
      financeSignal: fusion.financeSignal,
      financeSignalMeta: fusion.signalMeta,
    });
  }

  return {
    rows,
    meta: buildReadModelMeta({
      projectionSource: rows.length > 0 ? "live" : "empty",
      derivedFromTables: tables,
      missingSignals: [...allMissing],
    }),
  };
}

export async function loadDispatchReadinessRows(
  client: SupabaseClient,
  limit = 12,
): Promise<ExecutionReadModelResult<GovernanceBoardRow<DispatchReadinessInput>>> {
  const tables = ["orders", "dispatch_readiness_evidence", "operational_scan_records"];
  const evidenceOk = await probeTable(client, "dispatch_readiness_evidence");
  if (!evidenceOk) {
    return emptyReadModelResult("unavailable", tables, ["dispatch_readiness_evidence_table"]);
  }

  const { data: orders, error } = await client
    .from("orders")
    .select(ORDER_SELECT)
    .in("status", ["cleared_for_dispatch", "packed_ready", "ready_for_dispatch", "awaiting_final_payment"])
    .eq("is_waste", false)
    .order("created_at", { ascending: false })
    .limit(limit);

  if (error) return emptyReadModelResult("unavailable", tables, [error.message]);

  const orderIds = (orders ?? []).map((o) => o.id as string);
  if (orderIds.length === 0) {
    return { rows: [], meta: buildReadModelMeta({ projectionSource: "empty", derivedFromTables: tables }) };
  }

  const [{ data: evidence }, { data: scans }] = await Promise.all([
    client
      .from("dispatch_readiness_evidence")
      .select("order_id, evidence_type, evidence_status, created_at")
      .in("order_id", orderIds)
      .order("created_at", { ascending: false }),
    client
      .from("operational_scan_records")
      .select("order_id, verification_status, scan_type, created_at")
      .in("order_id", orderIds)
      .order("created_at", { ascending: false }),
  ]);

  const financeRows = await loadFinanceGovernanceRows(client, limit);
  const financeByOrder = new Map(financeRows.rows.map((r) => [r.input.orderId, r]));

  const rows: GovernanceBoardRow<DispatchReadinessInput>[] = [];
  const allMissing = new Set<string>();

  for (const o of orders ?? []) {
    const oid = o.id as string;
    const orderEvidence = (evidence ?? []).filter((e) => e.order_id === oid);
    const orderScans = (scans ?? []).filter((s) => s.order_id === oid) as {
      verification_status: string;
      scan_type: string;
      created_at: string;
    }[];
    const finRow = financeByOrder.get(oid);
    const financeSignal = finRow?.financeSignal ?? "unknown";
    const financeMeta = finRow?.financeSignalMeta ?? deriveSignalMeta(null);

    const fusion = deriveReadinessInputFromSlices({
      orderId: oid,
      reservationStatus: "reserved" as ReservationReadinessStatus,
      financeSignal,
      financeMeta,
      scan: scanSliceFromRecords(orderScans),
      evidence: orderEvidence.map((e) => ({
        evidenceType: e.evidence_type as string,
        evidenceStatus: e.evidence_status as string,
        createdAt: e.created_at as string,
      })),
    });
    fusion.missingSignals.forEach((m) => allMissing.add(m));
    rows.push({ input: fusion.input, missingSignals: fusion.missingSignals });
  }

  return {
    rows,
    meta: buildReadModelMeta({
      projectionSource: rows.length > 0 ? "live" : "empty",
      derivedFromTables: tables,
      missingSignals: [...allMissing],
    }),
  };
}

export async function loadDispatchCompletionRows(
  client: SupabaseClient,
  limit = 12,
): Promise<ExecutionReadModelResult<GovernanceBoardRow<DispatchCompletionInput>>> {
  const tables = [
    "orders",
    "dispatch_completion_evidence",
    "dispatch_readiness_evidence",
    "finance_review_evidence",
    "operational_scan_records",
  ];
  const ok = await probeTable(client, "dispatch_completion_evidence");
  if (!ok) return emptyReadModelResult("unavailable", tables, ["dispatch_completion_evidence_table"]);

  const { data: orders, error } = await client
    .from("orders")
    .select(ORDER_SELECT)
    .in("status", ["cleared_for_dispatch", "packed_ready"])
    .eq("is_waste", false)
    .order("created_at", { ascending: false })
    .limit(limit);

  if (error) return emptyReadModelResult("unavailable", tables, [error.message]);
  const orderIds = (orders ?? []).map((o) => o.id as string);
  if (!orderIds.length) {
    return { rows: [], meta: buildReadModelMeta({ projectionSource: "empty", derivedFromTables: tables }) };
  }

  const readinessOk = await probeTable(client, "dispatch_readiness_evidence");

  const [{ data: evidence }, { data: scans }, { data: readinessEvidence }, financeRows] = await Promise.all([
    client
      .from("dispatch_completion_evidence")
      .select("order_id, evidence_type, evidence_status, evidence_ref, created_at")
      .in("order_id", orderIds)
      .order("created_at", { ascending: false }),
    client
      .from("operational_scan_records")
      .select("order_id, verification_status, scan_type, created_at")
      .in("order_id", orderIds)
      .order("created_at", { ascending: false }),
    readinessOk
      ? client
          .from("dispatch_readiness_evidence")
          .select("order_id, evidence_type, evidence_status, created_at")
          .in("order_id", orderIds)
          .order("created_at", { ascending: false })
      : Promise.resolve({ data: [] as { order_id: string; evidence_type: string; evidence_status: string; created_at: string }[] }),
    loadFinanceGovernanceRows(client, limit),
  ]);

  const financeByOrder = new Map(financeRows.rows.map((r) => [r.input.orderId, r]));
  const rows: GovernanceBoardRow<DispatchCompletionInput>[] = [];
  const allMissing = new Set<string>();

  for (const o of orders ?? []) {
    const oid = o.id as string;
    const orderScans = (scans ?? []).filter((s) => s.order_id === oid) as {
      verification_status: string;
      scan_type: string;
      created_at: string;
    }[];
    const scan = scanSliceFromRecords(orderScans);
    const readinessSlices = (readinessEvidence ?? [])
      .filter((e) => e.order_id === oid)
      .map((e) => ({
        evidenceType: e.evidence_type as string,
        evidenceStatus: e.evidence_status as string,
        createdAt: e.created_at as string,
      }));
    const finRow = financeByOrder.get(oid);
    const financeInput = finRow?.input;
    const financeSignal = finRow?.financeSignal ?? "unknown";
    const financeReleaseStatus = financeInput
      ? deriveFinanceReleaseStatusFromInput(financeInput)
      : ("pending_finance_review" as FinanceReleaseStatus);
    const readinessStatus = deriveReadinessStatusFromEvidence(readinessSlices);

    const fusion = deriveCompletionInputFromSlices({
      orderId: oid,
      orderStatus: o.status as string,
      readinessStatus,
      financeSignal: financeSignalForFinalization(financeSignal),
      financeReleaseStatus,
      reservationReady: true,
      scanRejected: scan.hasRejectedGateScan,
      scanMismatch: scan.hasUnresolvedMismatch,
      evidence: (evidence ?? [])
        .filter((e) => e.order_id === oid)
        .map((e) => ({
          evidenceType: e.evidence_type as string,
          evidenceStatus: e.evidence_status as string,
          createdAt: e.created_at as string,
        })),
    });
    fusion.missingSignals.forEach((m) => allMissing.add(m));
    finRow?.missingSignals.forEach((m) => allMissing.add(m));
    rows.push({ input: fusion.input, missingSignals: fusion.missingSignals });
  }

  return {
    rows,
    meta: buildReadModelMeta({
      projectionSource: rows.length > 0 ? "live" : "empty",
      derivedFromTables: tables,
      missingSignals: [...allMissing],
    }),
  };
}

export async function loadDispatchFinalizationRows(
  client: SupabaseClient,
  limit = 12,
): Promise<ExecutionReadModelResult<GovernanceBoardRow<DispatchFinalizationInput>>> {
  const tables = [
    "orders",
    "dispatch_release_lineage",
    "dispatch_readiness_evidence",
    "dispatch_completion_evidence",
    "finance_review_evidence",
    "operational_scan_records",
  ];
  const ok = await probeTable(client, "dispatch_release_lineage");
  if (!ok) return emptyReadModelResult("unavailable", tables, ["dispatch_release_lineage_table"]);

  const { data: orders, error } = await client
    .from("orders")
    .select(ORDER_SELECT)
    .in("status", ["cleared_for_dispatch", "packed_ready", "dispatched"])
    .eq("is_waste", false)
    .order("created_at", { ascending: false })
    .limit(limit);

  if (error) return emptyReadModelResult("unavailable", tables, [error.message]);
  const orderIds = (orders ?? []).map((o) => o.id as string);
  if (!orderIds.length) {
    return { rows: [], meta: buildReadModelMeta({ projectionSource: "empty", derivedFromTables: tables }) };
  }

  const readinessOk = await probeTable(client, "dispatch_readiness_evidence");
  const completionOk = await probeTable(client, "dispatch_completion_evidence");

  const [
    { data: lineage },
    { data: readinessEvidence },
    { data: completionEvidence },
    { data: scans },
    financeRows,
  ] = await Promise.all([
    client
      .from("dispatch_release_lineage")
      .select("order_id, release_type, next_status, created_at, transporter_reference, gate_reference, completion_reference")
      .in("order_id", orderIds)
      .order("created_at", { ascending: false }),
    readinessOk
      ? client
          .from("dispatch_readiness_evidence")
          .select("order_id, evidence_type, evidence_status, evidence_ref, created_at")
          .in("order_id", orderIds)
          .order("created_at", { ascending: false })
      : Promise.resolve({
          data: [] as {
            order_id: string;
            evidence_type: string;
            evidence_status: string;
            evidence_ref: string | null;
            created_at: string;
          }[],
        }),
    completionOk
      ? client
          .from("dispatch_completion_evidence")
          .select("order_id, evidence_type, evidence_status, evidence_ref, created_at")
          .in("order_id", orderIds)
          .order("created_at", { ascending: false })
      : Promise.resolve({
          data: [] as {
            order_id: string;
            evidence_type: string;
            evidence_status: string;
            evidence_ref: string | null;
            created_at: string;
          }[],
        }),
    client
      .from("operational_scan_records")
      .select("order_id, verification_status, scan_type, barcode_value, created_at")
      .in("order_id", orderIds)
      .order("created_at", { ascending: false }),
    loadFinanceGovernanceRows(client, limit),
  ]);

  const financeByOrder = new Map(financeRows.rows.map((r) => [r.input.orderId, r]));
  const rows: GovernanceBoardRow<DispatchFinalizationInput>[] = [];
  const allMissing = new Set<string>();

  for (const o of orders ?? []) {
    const oid = o.id as string;
    const orderLineage = (lineage ?? []).filter((l) => l.order_id === oid);
    const readinessSlices = (readinessEvidence ?? [])
      .filter((e) => e.order_id === oid)
      .map((e) => ({
        evidenceType: e.evidence_type as string,
        evidenceStatus: e.evidence_status as string,
        evidenceRef: e.evidence_ref as string | null,
        createdAt: e.created_at as string,
      }));
    const completionSlices = (completionEvidence ?? [])
      .filter((e) => e.order_id === oid)
      .map((e) => ({
        evidenceType: e.evidence_type as string,
        evidenceStatus: e.evidence_status as string,
        evidenceRef: e.evidence_ref as string | null,
        createdAt: e.created_at as string,
      }));
    const orderScans = (scans ?? [])
      .filter((s) => s.order_id === oid)
      .map((s) => ({
        scanType: s.scan_type as string,
        verificationStatus: s.verification_status as string,
        barcodeValue: (s.barcode_value as string) ?? null,
      }));

    const finRow = financeByOrder.get(oid);
    const financeInput = finRow?.input;
    const financeSignal = financeSignalForFinalization(finRow?.financeSignal ?? "unknown");
    const financeReleaseStatus = financeInput
      ? deriveFinanceReleaseStatusFromInput(financeInput)
      : ("pending_finance_review" as FinanceReleaseStatus);
    const readinessStatus = deriveReadinessStatusFromEvidence(readinessSlices);
    const completionStatus = deriveCompletionStatusFromEvidence(completionSlices, o.status as string);

    const lineageGate =
      orderLineage.find((l) => (l.gate_reference as string | null)?.trim())?.gate_reference ?? null;
    const lineageCompletion =
      orderLineage.find((l) => (l.completion_reference as string | null)?.trim())?.completion_reference ?? null;
    const gateReference =
      (lineageGate as string | null) ?? resolveGateReferenceFromSlices(readinessSlices, orderScans);
    const completionReference =
      (lineageCompletion as string | null) ?? resolveCompletionReferenceFromEvidence(completionSlices);
    const transporterReference = resolveTransporterReference(
      (orderLineage[0]?.transporter_reference as string) ?? null,
      gateReference,
      completionReference,
    );

    const fusion = deriveFinalizationInputFromSlices({
      orderId: oid,
      currentOrderStatus: o.status as string,
      readinessStatus,
      financeSignal,
      financeReleaseStatus,
      completionStatus,
      reservationReady: true,
      transporterReference,
      gateReference,
      completionReference,
      lineage: orderLineage.map((l) => ({
        releaseType: l.release_type as string,
        nextStatus: l.next_status as string,
        createdAt: l.created_at as string,
      })),
      financeBlocked: financeSignal === "blocked",
      scanBlocked: orderScans.some((s) => s.verificationStatus === "rejected" || s.verificationStatus === "mismatch"),
    });
    fusion.missingSignals.forEach((m) => allMissing.add(m));
    finRow?.missingSignals.forEach((m) => allMissing.add(m));
    rows.push({ input: fusion.input, missingSignals: fusion.missingSignals });
  }

  return {
    rows,
    meta: buildReadModelMeta({
      projectionSource: rows.length > 0 ? "live" : "empty",
      derivedFromTables: tables,
      missingSignals: [...allMissing],
    }),
  };
}

function resolveStockEvidenceFromLineageAndScans(
  orderLineage: {
    id: string;
    gate_reference: string | null;
    next_status: string;
    release_type: string;
  }[],
  orderScans: { scan_type: string; verification_status: string; barcode_value: string }[],
): {
  dispatchReleaseStatus: DispatchReleaseStatus;
  dispatchLineageId: string | null;
  scanReference: string | null;
  gateReference: string | null;
} {
  const dispatched = orderLineage.some((l) => l.next_status === "dispatched");
  const dispatchReleaseStatus: DispatchReleaseStatus = dispatched
    ? "dispatch_finalized"
    : "dispatch_release_ready";

  const finalizeRow =
    orderLineage.find((l) => l.next_status === "dispatched") ??
    orderLineage.find((l) => l.release_type === "finalize") ??
    orderLineage[0];

  const gateFromLineage = orderLineage.find((l) => l.gate_reference?.trim())?.gate_reference ?? null;
  const gateReference = gateFromLineage ?? finalizeRow?.gate_reference ?? null;

  const verifiedScan = orderScans.find(
    (s) =>
      (s.scan_type === "carton" || s.scan_type === "packing" || s.scan_type === "dispatch_gate") &&
      s.verification_status === "verified" &&
      s.barcode_value?.trim(),
  );
  const scanReference = verifiedScan?.barcode_value?.trim() ?? null;

  return {
    dispatchReleaseStatus,
    dispatchLineageId: finalizeRow?.id ?? null,
    scanReference,
    gateReference: gateReference?.trim() ? gateReference : null,
  };
}

export async function loadStockFinalizationRows(
  client: SupabaseClient,
  limit = 8,
): Promise<ExecutionReadModelResult<GovernanceBoardRow<StockFinalizationInput>>> {
  const tables = [
    "orders",
    "inventory_reservations",
    "inventory_stock_balances",
    "stock_consumption_lineage",
    "dispatch_release_lineage",
    "operational_scan_records",
  ];
  const stockOk = await probeTable(client, "inventory_stock_balances");
  if (!stockOk) {
    return emptyReadModelResult("unavailable", tables, ["inventory_stock_balances_table"]);
  }

  const lineageOk = await probeTable(client, "dispatch_release_lineage");
  if (!lineageOk) {
    return emptyReadModelResult("unavailable", tables, ["dispatch_release_lineage_table"]);
  }

  const { data: orders, error } = await client
    .from("orders")
    .select(ORDER_SELECT)
    .eq("status", "dispatched")
    .eq("is_waste", false)
    .order("created_at", { ascending: false })
    .limit(limit);

  if (error) return emptyReadModelResult("unavailable", tables, [error.message]);
  const orderIds = (orders ?? []).map((o) => o.id as string);
  if (!orderIds.length) {
    return { rows: [], meta: buildReadModelMeta({ projectionSource: "empty", derivedFromTables: tables }) };
  }

  const [{ data: reservations }, { data: balances }, { data: lineage }, { data: dispatchLineage }, { data: scans }] =
    await Promise.all([
      client
        .from("inventory_reservations")
        .select(
          "id, reservation_number, order_id, product_id, sku, requested_qty, reserved_qty, fulfilled_qty, released_qty, reservation_status",
        )
        .in("order_id", orderIds),
      client
        .from("inventory_stock_balances")
        .select("product_id, sku, location_code, available_qty, reserved_qty, version"),
      client
        .from("stock_consumption_lineage")
        .select("order_id, reservation_id, lineage_type, created_at")
        .in("order_id", orderIds)
        .order("created_at", { ascending: false }),
      client
        .from("dispatch_release_lineage")
        .select("id, order_id, release_type, next_status, gate_reference, created_at")
        .in("order_id", orderIds)
        .order("created_at", { ascending: false }),
      client
        .from("operational_scan_records")
        .select("order_id, scan_type, verification_status, barcode_value, created_at")
        .in("order_id", orderIds)
        .order("created_at", { ascending: false }),
    ]);

  const rows: GovernanceBoardRow<StockFinalizationInput>[] = [];
  const allMissing = new Set<string>();

  for (const o of orders ?? []) {
    const oid = o.id as string;
    const orderReservations: StockReservationRecord[] = (reservations ?? [])
      .filter((r) => r.order_id === oid)
      .map((r) => ({
        id: r.id as string,
        reservationNumber: r.reservation_number as string,
        orderId: oid,
        productId: r.product_id as string,
        sku: r.sku as string,
        requestedQty: Number(r.requested_qty),
        reservedQty: Number(r.reserved_qty),
        fulfilledQty: Number(r.fulfilled_qty),
        releasedQty: Number(r.released_qty),
        reservationStatus: r.reservation_status as StockReservationRecord["reservationStatus"],
      }));

    const orderLineage = (dispatchLineage ?? [])
      .filter((l) => l.order_id === oid)
      .map((l) => ({
        id: l.id as string,
        gate_reference: l.gate_reference as string | null,
        next_status: l.next_status as string,
        release_type: l.release_type as string,
      }));
    const orderScans = (scans ?? [])
      .filter((s) => s.order_id === oid)
      .map((s) => ({
        scan_type: s.scan_type as string,
        verification_status: s.verification_status as string,
        barcode_value: s.barcode_value as string,
      }));
    const evidence = resolveStockEvidenceFromLineageAndScans(orderLineage, orderScans);
    const locationCode =
      (balances ?? []).find((b) => orderReservations.some((r) => r.sku === b.sku))?.location_code ??
      "WH-MAIN";

    const consumptionLineageSlices = (lineage ?? [])
      .filter((l) => l.order_id === oid)
      .map((l) => ({
        reservationId: l.reservation_id as string,
        lineageType: l.lineage_type as string,
      }));

    if (
      !shouldShowOrderAsStockFinalizationCandidate({
        orderStatus: o.status as string,
        dispatchFinalized: evidence.dispatchReleaseStatus === "dispatch_finalized",
        lineage: consumptionLineageSlices,
        reservations: orderReservations,
      })
    ) {
      continue;
    }

    const fusion = deriveStockInputFromSlices({
      orderId: oid,
      orderStatus: o.status as string,
      dispatchReleaseStatus: evidence.dispatchReleaseStatus,
      reservations: orderReservations,
      scanReference: evidence.scanReference,
      gateReference: evidence.gateReference,
      dispatchLineageId: evidence.dispatchLineageId,
      locationCode: locationCode as string,
      balances: (balances ?? []).map((b) => ({
        productId: b.product_id as string,
        sku: b.sku as string,
        locationCode: b.location_code as string,
        availableQty: Number(b.available_qty),
        reservedQty: Number(b.reserved_qty),
        version: Number(b.version),
      })),
      lineage: (lineage ?? [])
        .filter((l) => l.order_id === oid)
        .map((l) => ({
          reservationId: l.reservation_id as string,
          lineageType: l.lineage_type as string,
          createdAt: l.created_at as string,
        })),
    });
    fusion.missingSignals.forEach((m) => allMissing.add(m));
    rows.push({ input: fusion.input, missingSignals: fusion.missingSignals });
  }

  return {
    rows,
    meta: buildReadModelMeta({
      projectionSource: rows.length > 0 ? "live" : "empty",
      derivedFromTables: tables,
      missingSignals: [...allMissing],
    }),
  };
}
