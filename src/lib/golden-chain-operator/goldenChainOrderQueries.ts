import type { SupabaseClient } from "@supabase/supabase-js";
import { deriveCompletionInputFromSlices } from "@/lib/execution-read-models/adapters/completionSignalAdapter";
import { deriveFinalizationInputFromSlices } from "@/lib/execution-read-models/adapters/finalizationSignalAdapter";
import { deriveFinanceSignalFromSlices } from "@/lib/execution-read-models/adapters/financeSignalAdapter";
import { deriveReadinessInputFromSlices } from "@/lib/execution-read-models/adapters/readinessSignalAdapter";
import { deriveStockInputFromSlices } from "@/lib/execution-read-models/adapters/stockSignalAdapter";
import {
  deriveCompletionStatusFromEvidence,
  deriveFinanceReleaseStatusFromInput,
  deriveReadinessStatusFromEvidence,
  financeSignalForFinalization,
  resolveCompletionReferenceFromEvidence,
  resolveGateReferenceFromSlices,
  resolveTransporterReference,
} from "@/lib/execution-read-models/adapters/governanceEvidenceFusion";
import { scanSliceFromRecords } from "@/lib/execution-read-models/queries/governanceReadQueries";
import type {
  FinanceGovernanceInput,
  FinanceReleaseStatus,
} from "@/lib/finance-governance/financeGovernanceTypes";
import { projectFinanceRelease } from "@/lib/finance-governance/financeReleaseEligibility";
import type { ReservationReadinessStatus } from "@/lib/dispatch-readiness/dispatchReadinessTypes";
import type { StockReservationRecord } from "@/lib/stock-finalization/stockReservationTypes";
import { deriveGoldenChainStaffStage } from "@/lib/golden-chain/deriveGoldenChainStage";
import {
  buildGoldenChainWizardCompletionInput,
  hasVerifiedCompletionAttestation,
} from "./goldenChainCompletionInput";
import { isDispatchEvidencePrepared } from "./goldenChainPrerequisites";
import { buildGoldenChainEvidenceRefs } from "./goldenChainEvidenceRefs";
import { blockersForStage, whoMustActForStage } from "./goldenChainBlockers";
import {
  deriveGoldenChainStage,
  governanceStageLabel,
  type GoldenChainDerivationInput,
} from "./goldenChainStageDerivation";
import { loadOrderLinesForReservation } from "@/lib/inventory-reservations/reservationBoardQueries";
import { filterActiveReservationsForStock } from "./goldenChainStockFilters";
import type { GoldenChainOrderState, GoldenChainOrderSummary } from "./goldenChainTypes";

const PIPELINE_STATUSES = [
  "cleared_for_dispatch",
  "packed_ready",
  "awaiting_final_payment",
  "ready_for_dispatch",
  "in_production",
  "manufacturing",
  "dispatched",
  "in_transit",
] as const;

const ORDER_SELECT =
  "id, order_number, status, sales_order_value, advance_required, advance_paid, payment_status, created_at, company_id, company:companies(business_name)";

function mapReservations(
  rows: {
    id: string;
    reservation_number: string;
    order_id: string;
    product_id: string;
    sku: string;
    requested_qty: number | string;
    reserved_qty: number | string;
    fulfilled_qty: number | string;
    released_qty: number | string;
    reservation_status: string;
  }[],
  orderId: string,
): StockReservationRecord[] {
  return rows
    .filter((r) => r.order_id === orderId)
    .map((r) => ({
      id: r.id,
      reservationNumber: r.reservation_number,
      orderId,
      productId: r.product_id,
      sku: r.sku,
      requestedQty: Number(r.requested_qty),
      reservedQty: Number(r.reserved_qty),
      fulfilledQty: Number(r.fulfilled_qty),
      releasedQty: Number(r.released_qty),
      reservationStatus: r.reservation_status as StockReservationRecord["reservationStatus"],
    }));
}

export async function searchGoldenChainOrders(
  client: SupabaseClient,
  query: string,
  limit = 40,
): Promise<GoldenChainOrderSummary[]> {
  const q = query.replace(/%/g, "").replace(/_/g, "").trim();
  let orderQuery = client
    .from("orders")
    .select(ORDER_SELECT)
    .in("status", [...PIPELINE_STATUSES])
    .eq("is_waste", false)
    .order("created_at", { ascending: false })
    .limit(limit);

  if (q.length >= 2) {
    const tail = q.replace(/^SO-/i, "").trim();
    // PostgREST cannot apply ilike to uuid `id`; order_number covers SO search.
    orderQuery = orderQuery.ilike("order_number", `%${tail}%`);
  }

  const { data: orders, error } = await orderQuery;
  if (error) throw new Error(error.message);
  const summaries: GoldenChainOrderSummary[] = [];

  for (const o of orders ?? []) {
    const state = await loadGoldenChainOrderState(client, o.id as string).catch(() => null);
    if (!state) continue;
    summaries.push({
      orderId: state.orderId,
      orderNumber: state.orderNumber,
      orderStatus: state.orderStatus,
      paymentStatus: state.paymentStatus,
      governanceStageLabel: governanceStageLabel(state.stage),
      nextAction: state.cta,
    });
  }

  return summaries;
}

export async function loadGoldenChainOrderState(
  client: SupabaseClient,
  orderId: string,
): Promise<GoldenChainOrderState | null> {
  const { data: order, error } = await client.from("orders").select(ORDER_SELECT).eq("id", orderId).maybeSingle();
  if (error) throw new Error(error.message);
  if (!order) return null;

  const [
    { data: readinessEvidence },
    { data: financeEvidence },
    { data: completionEvidence },
    { data: scans },
    { data: reservations },
    { data: dispatchLineage },
    { data: consumptionLineage },
    { data: balances },
  ] = await Promise.all([
    client
      .from("dispatch_readiness_evidence")
      .select("order_id, evidence_type, evidence_status, evidence_ref, created_at")
      .eq("order_id", orderId)
      .order("created_at", { ascending: false }),
    client
      .from("finance_review_evidence")
      .select("order_id, review_status, review_type, created_at")
      .eq("order_id", orderId)
      .order("created_at", { ascending: false }),
    client
      .from("dispatch_completion_evidence")
      .select("order_id, evidence_type, evidence_status, evidence_ref, created_at")
      .eq("order_id", orderId)
      .order("created_at", { ascending: false }),
    client
      .from("operational_scan_records")
      .select("order_id, verification_status, scan_type, barcode_value, created_at")
      .eq("order_id", orderId)
      .order("created_at", { ascending: false }),
    client
      .from("inventory_reservations")
      .select(
        "id, reservation_number, order_id, product_id, sku, requested_qty, reserved_qty, fulfilled_qty, released_qty, reservation_status",
      )
      .eq("order_id", orderId),
    client
      .from("dispatch_release_lineage")
      .select(
        "id, order_id, release_type, next_status, created_at, transporter_reference, gate_reference, completion_reference",
      )
      .eq("order_id", orderId)
      .order("created_at", { ascending: false }),
    client
      .from("stock_consumption_lineage")
      .select("order_id, reservation_id, lineage_type, created_at")
      .eq("order_id", orderId)
      .order("created_at", { ascending: false }),
    client.from("inventory_stock_balances").select("product_id, sku, location_code, available_qty, reserved_qty, version"),
  ]);

  const readinessSlices = (readinessEvidence ?? []).map((e) => ({
    evidenceType: e.evidence_type as string,
    evidenceStatus: e.evidence_status as string,
    evidenceRef: (e.evidence_ref as string | null) ?? null,
    createdAt: e.created_at as string,
  }));

  const orderScans = (scans ?? []).map((s) => ({
    verification_status: s.verification_status as string,
    scan_type: s.scan_type as string,
    created_at: s.created_at as string,
    barcode_value: (s.barcode_value as string | null) ?? null,
  }));

  const scan = scanSliceFromRecords(orderScans);
  const financeFusion = deriveFinanceSignalFromSlices(
    {
      orderId,
      orderValue: Number(order.sales_order_value ?? 0),
      advanceRequired: Number(order.advance_required ?? 0),
      advanceVerified: Number(order.advance_paid ?? 0) >= Number(order.advance_required ?? 0),
      paymentStatus: (order.payment_status as string) ?? null,
      updatedAt: (order.created_at as string) ?? null,
    },
    (financeEvidence ?? []).map((e) => ({
      reviewStatus: e.review_status as string,
      reviewType: e.review_type as string,
      createdAt: e.created_at as string,
    })),
    { dispatchReadinessGateEligible: deriveReadinessStatusFromEvidence(readinessSlices) === "gate_eligible" },
  );

  const reservationRows = mapReservations(reservations ?? [], orderId);
  const activeReservations = filterActiveReservationsForStock(reservationRows);
  const reservationStatus: ReservationReadinessStatus = activeReservations.some((r) => r.reservedQty > 0)
    ? "reserved"
    : "none";

  const orderStatus = (order.status as string) ?? "";
  const orderDispatched = ["dispatched", "in_transit", "delivered"].includes(
    orderStatus.trim().toLowerCase(),
  );
  const readinessPolicy = orderDispatched ? ("full" as const) : ("pre_dispatch" as const);

  const readinessFusion = deriveReadinessInputFromSlices({
    orderId,
    reservationStatus,
    financeSignal: financeFusion.financeSignal,
    financeMeta: financeFusion.signalMeta,
    scan,
    evidence: readinessSlices.map((e) => ({
      evidenceType: e.evidenceType,
      evidenceStatus: e.evidenceStatus,
      createdAt: e.createdAt,
    })),
  });
  readinessFusion.input.readinessPolicy = readinessPolicy;

  const financeReleaseStatus: FinanceReleaseStatus = deriveFinanceReleaseStatusFromInput(financeFusion.input);
  const readinessStatus = deriveReadinessStatusFromEvidence(readinessSlices);
  const completionSlices = (completionEvidence ?? []).map((e) => ({
    evidenceType: e.evidence_type as string,
    evidenceStatus: e.evidence_status as string,
    evidenceRef: (e.evidence_ref as string | null) ?? null,
    createdAt: e.created_at as string,
  }));
  const completionStatus = deriveCompletionStatusFromEvidence(completionSlices, order.status as string);

  const completionFusion = deriveCompletionInputFromSlices({
    orderId,
    orderStatus: order.status as string,
    readinessStatus,
    financeSignal: financeSignalForFinalization(financeFusion.financeSignal),
    financeReleaseStatus,
    reservationReady: activeReservations.length > 0,
    scanRejected: scan.hasRejectedGateScan,
    scanMismatch: scan.hasUnresolvedMismatch,
    evidence: completionSlices,
  });

  const completionAttested = hasVerifiedCompletionAttestation(completionSlices);

  const lineageSlices = (dispatchLineage ?? []).map((l) => ({
    releaseType: l.release_type as string,
    nextStatus: l.next_status as string,
    createdAt: l.created_at as string,
  }));

  const gateReference =
    resolveGateReferenceFromSlices(readinessSlices, orderScans.map((s) => ({
      scanType: s.scan_type,
      verificationStatus: s.verification_status,
      barcodeValue: s.barcode_value,
    }))) ??
    (dispatchLineage?.find((l) => l.gate_reference)?.gate_reference as string | null) ??
    null;

  const completionReference =
    resolveCompletionReferenceFromEvidence(completionSlices) ??
    (dispatchLineage?.find((l) => l.completion_reference)?.completion_reference as string | null) ??
    null;

  const transporterReference = resolveTransporterReference(
    (dispatchLineage?.[0]?.transporter_reference as string) ?? null,
    gateReference,
    completionReference,
  );

  const finalizationFusion = deriveFinalizationInputFromSlices({
    orderId,
    currentOrderStatus: order.status as string,
    readinessStatus,
    financeSignal: financeSignalForFinalization(financeFusion.financeSignal),
    financeReleaseStatus,
    completionStatus,
    reservationReady: activeReservations.length > 0,
    transporterReference,
    gateReference,
    completionReference,
    lineage: lineageSlices,
    financeBlocked: financeFusion.financeSignal === "blocked",
    scanBlocked: orderScans.some(
      (s) => s.verification_status === "rejected" || s.verification_status === "mismatch",
    ),
  });

  const consumptionFinalizedReservationIds = (consumptionLineage ?? [])
    .filter((l) => l.lineage_type === "consumption_finalized")
    .map((l) => l.reservation_id as string);

  const dispatchedLineage = lineageSlices.some((l) => l.nextStatus === "dispatched");
  const dispatchReleaseStatus = dispatchedLineage ? ("dispatch_finalized" as const) : ("dispatch_release_ready" as const);
  const finalizeRow =
    (dispatchLineage ?? []).find((l) => l.next_status === "dispatched") ??
    (dispatchLineage ?? []).find((l) => l.release_type === "finalize") ??
    dispatchLineage?.[0];
  const verifiedScan = orderScans.find(
    (s) =>
      (s.scan_type === "carton" || s.scan_type === "packing" || s.scan_type === "dispatch_gate") &&
      s.verification_status === "verified" &&
      s.barcode_value?.trim(),
  );
  const locationCode =
    (balances ?? []).find((b) => activeReservations.some((r) => r.sku === b.sku))?.location_code ?? "WH-MAIN";

  const stockFusion =
    order.status === "dispatched" || dispatchedLineage
      ? deriveStockInputFromSlices({
          orderId,
          orderStatus: order.status as string,
          dispatchReleaseStatus,
          reservations: activeReservations,
          scanReference: verifiedScan?.barcode_value?.trim() ?? null,
          gateReference: gateReference?.trim() ? gateReference : null,
          dispatchLineageId: (finalizeRow?.id as string | undefined) ?? null,
          locationCode: locationCode as string,
          balances: (balances ?? []).map((b) => ({
            productId: b.product_id as string,
            sku: b.sku as string,
            locationCode: b.location_code as string,
            availableQty: Number(b.available_qty),
            reservedQty: Number(b.reserved_qty),
            version: Number(b.version),
          })),
          lineage: (consumptionLineage ?? []).map((l) => ({
            reservationId: l.reservation_id as string,
            lineageType: l.lineage_type as string,
            createdAt: l.created_at as string,
          })),
        })
      : null;

  const evidenceSlicesForPrep = readinessSlices.map((e) => ({
    evidenceType: e.evidenceType,
    evidenceStatus: e.evidenceStatus,
    createdAt: e.createdAt,
  }));
  const dispatchEvidencePrepared = isDispatchEvidencePrepared(evidenceSlicesForPrep, scan);

  const financeInputForChain: FinanceGovernanceInput = {
    ...financeFusion.input,
    ...(orderDispatched
      ? { reservationReady: activeReservations.length > 0 }
      : {
          /** Golden-chain: reservation is created after dispatch finalize, not before finance/readiness. */
          reservationReady: true,
          dispatchReadinessGateEligible:
            dispatchEvidencePrepared ||
            deriveReadinessStatusFromEvidence(readinessSlices) === "gate_eligible",
        }),
  };

  const financeCommerciallyReleased =
    (financeEvidence ?? []).some(
      (e) => e.review_type === "commercial_release" && e.review_status === "released",
    ) ||
    (financeFusion.financeSignal === "ready" &&
      projectFinanceRelease(financeInputForChain).releaseStatus === "commercially_released");

  const wizardCompletionInput = buildGoldenChainWizardCompletionInput(completionFusion.input, {
    orderStatus,
    dispatchEvidencePrepared,
    financeCommerciallyReleased,
    scan,
    readinessSlices: evidenceSlicesForPrep,
    completionAttested,
  });

  const wizardFinalizationInput = orderDispatched
    ? finalizationFusion.input
    : {
        ...finalizationFusion.input,
        reservationReady: true,
        completionStatus: completionAttested ? ("completion_attested" as const) : completionStatus,
        finalizationPolicy: "pre_dispatch_wizard" as const,
      };

  const derivationInput: GoldenChainDerivationInput = {
    readinessInput: readinessFusion.input,
    financeInput: financeInputForChain,
    completionInput: wizardCompletionInput,
    finalizationInput: wizardFinalizationInput,
    stockInput: stockFusion?.input ?? null,
    reservations: reservationRows,
    dispatchLineage: lineageSlices,
    consumptionFinalizedReservationIds,
    readinessEvidenceSlices: evidenceSlicesForPrep,
    scanSlice: scan,
    dispatchEvidencePrepared,
    financeCommerciallyReleased,
    completionAttested,
  };

  const derived = deriveGoldenChainStage(derivationInput);
  const staff = deriveGoldenChainStaffStage(derivationInput);
  const gateBarcode = orderScans.find(
    (s) => s.scan_type === "dispatch_gate" && s.verification_status === "verified",
  )?.barcode_value;
  const cartonBarcode = orderScans.find(
    (s) => s.scan_type === "carton" && s.verification_status === "verified",
  )?.barcode_value;
  const evidenceRefs = buildGoldenChainEvidenceRefs(orderId, order.order_number as string | null, {
    gateBarcode,
    cartonBarcode,
  });

  const orderLines = await loadOrderLinesForReservation(client, orderId).then((lines) =>
    lines.map((l) => ({
      productId: l.productId,
      sku: l.sku,
      productName: l.productName,
      quantity: l.quantity,
    })),
  );

  const companyName =
    (order as { company?: { business_name?: string } | null }).company?.business_name ?? null;

  return {
    orderId,
    orderNumber: (order.order_number as string | null) ?? null,
    orderStatus: order.status as string,
    paymentStatus: (order.payment_status as string | null) ?? null,
    companyName,
    orderLines,
    staffStageLabel: staff.staffStageLabel,
    requiredRole: staff.requiredRole,
    whoMustActNext: whoMustActForStage(derived.stage),
    readinessInput: readinessFusion.input,
    financeInput: financeFusion.input,
    completionInput: wizardCompletionInput,
    finalizationInput: wizardFinalizationInput,
    stockInput: stockFusion?.input ?? null,
    reservations: reservationRows,
    dispatchLineage: lineageSlices,
    consumptionFinalizedReservationIds,
    readinessEvidenceSlices: evidenceSlicesForPrep,
    scanSlice: scan,
    dispatchEvidencePrepared,
    stage: derived.stage,
    cta: derived.cta,
    blockers: blockersForStage(
      derived.stage,
      [...derived.rawBlockers, ...staff.warnings],
    ),
    evidenceRefs,
    dispatchAlreadyFinalized: derived.dispatchAlreadyFinalized,
    stockConsumptionComplete: derived.stockConsumptionComplete,
  };
}
