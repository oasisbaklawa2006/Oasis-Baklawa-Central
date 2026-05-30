import type { SupabaseClient } from "@supabase/supabase-js";
import { mapReservationRow } from "./reservationDbMappers";
import { isReservationOpen } from "./reservationLifecycle";
import { buildAvailabilitySnapshotFromBalance, summarizeAvailability } from "./buildAvailabilitySnapshot";
import type { InventoryAvailabilitySnapshot, InventoryReservationRecord } from "./reservationTypes";
import type { InventoryReservationRow } from "./reservationDbTypes";

const DEFAULT_LOCATION = "WH-MAIN";

export interface ReservationOrderRow {
  id: string;
  orderNumber: string | null;
  status: string;
  /** Governance board label: Order {last4} */
  label: string;
}

export interface ReservationLineCandidate {
  productId: string;
  sku: string;
  productName: string;
  quantity: number;
}

export interface ReservationBalanceView {
  productId: string;
  sku: string;
  locationCode: string;
  availableQty: number;
  reservedQty: number;
  version: number;
}

export interface ReservationBoardOrderContext {
  order: ReservationOrderRow;
  lines: ReservationLineCandidate[];
  reservations: InventoryReservationRecord[];
  balance: ReservationBalanceView | null;
  locationCode: string;
  availability: InventoryAvailabilitySnapshot | null;
  availabilitySummary: ReturnType<typeof summarizeAvailability> | null;
  hasVerifiedScan: boolean;
  scanReference: string | null;
  reservationBlockers: string[];
  stockFinalizationHints: string[];
}

export function orderGovernanceLabel(orderId: string, orderNumber: string | null): string {
  if (orderNumber?.trim()) return `${orderNumber} · …${orderId.slice(-4)}`;
  return `Order ${orderId.slice(-4)}`;
}

export async function loadDispatchedOrdersForReservationBoard(
  client: SupabaseClient,
  limit = 12,
): Promise<ReservationOrderRow[]> {
  const { data, error } = await client
    .from("orders")
    .select("id, order_number, status")
    .eq("status", "dispatched")
    .eq("is_waste", false)
    .order("created_at", { ascending: false })
    .limit(limit);
  if (error) throw new Error(error.message);
  return (data ?? []).map((o) => ({
    id: o.id as string,
    orderNumber: (o.order_number as string | null) ?? null,
    status: o.status as string,
    label: orderGovernanceLabel(o.id as string, (o.order_number as string | null) ?? null),
  }));
}

export async function sumOpenReservedQtyForSku(
  client: SupabaseClient,
  productId: string,
  sku: string,
  excludeOrderId?: string,
): Promise<number> {
  const { data, error } = await client
    .from("inventory_reservations")
    .select("order_id, reserved_qty, released_qty, reservation_status")
    .eq("product_id", productId)
    .eq("sku", sku);
  if (error) throw new Error(error.message);
  return (data ?? []).reduce((sum, row) => {
    if (excludeOrderId && row.order_id === excludeOrderId) return sum;
    const status = row.reservation_status as string;
    if (!isReservationOpen(status as InventoryReservationRecord["reservationStatus"])) return sum;
    const held = Math.max(0, Number(row.reserved_qty) - Number(row.released_qty ?? 0));
    return sum + held;
  }, 0);
}

export async function loadReservationBoardOrderContext(
  client: SupabaseClient,
  orderId: string,
  line: ReservationLineCandidate,
  locationCode = DEFAULT_LOCATION,
): Promise<ReservationBoardOrderContext> {
  const [orderRes, itemsRes, reservationsRes, balanceRes, scansRes] = await Promise.all([
    client.from("orders").select("id, order_number, status").eq("id", orderId).maybeSingle(),
    client
      .from("order_items")
      .select("quantity, product_id, product:products(id, name, sku)")
      .eq("order_id", orderId),
    client.from("inventory_reservations").select("*").eq("order_id", orderId).order("created_at", { ascending: false }),
    client
      .from("inventory_stock_balances")
      .select("product_id, sku, location_code, available_qty, reserved_qty, version")
      .eq("product_id", line.productId)
      .eq("sku", line.sku)
      .eq("location_code", locationCode)
      .maybeSingle(),
    client
      .from("operational_scan_records")
      .select("barcode_value, scan_type, verification_status")
      .eq("order_id", orderId)
      .order("created_at", { ascending: false })
      .limit(10),
  ]);

  if (orderRes.error) throw new Error(orderRes.error.message);
  if (!orderRes.data) throw new Error("Order not found");

  const order: ReservationOrderRow = {
    id: orderRes.data.id as string,
    orderNumber: (orderRes.data.order_number as string | null) ?? null,
    status: orderRes.data.status as string,
    label: orderGovernanceLabel(orderRes.data.id as string, (orderRes.data.order_number as string | null) ?? null),
  };

  const lines: ReservationLineCandidate[] = (itemsRes.data ?? [])
    .map((row) => {
      const product = row.product as { id?: string; name?: string; sku?: string } | null;
      const sku = product?.sku?.trim();
      const productId = (row.product_id as string) || product?.id;
      if (!productId || !sku) return null;
      return {
        productId,
        sku,
        productName: product?.name?.trim() || sku,
        quantity: Math.max(1, Number(row.quantity) || 1),
      };
    })
    .filter((x): x is ReservationLineCandidate => x !== null);

  const reservations = ((reservationsRes.data ?? []) as InventoryReservationRow[]).map(mapReservationRow);

  const balanceRow = balanceRes.data;
  const balance: ReservationBalanceView | null = balanceRow
    ? {
        productId: balanceRow.product_id as string,
        sku: balanceRow.sku as string,
        locationCode: balanceRow.location_code as string,
        availableQty: Number(balanceRow.available_qty),
        reservedQty: Number(balanceRow.reserved_qty),
        version: Number(balanceRow.version),
      }
    : null;

  const openReservedQty = await sumOpenReservedQtyForSku(client, line.productId, line.sku, orderId);
  const availability = buildAvailabilitySnapshotFromBalance({
    productId: line.productId,
    sku: line.sku,
    balance,
    openReservedQty,
  });
  const availabilitySummary = summarizeAvailability(availability);

  const scans = (scansRes.data ?? []) as {
    barcode_value: string | null;
    scan_type: string;
    verification_status: string;
  }[];
  const verifiedScan = scans.find(
    (s) =>
      (s.scan_type === "carton" || s.scan_type === "packing" || s.scan_type === "dispatch_gate") &&
      s.verification_status === "verified" &&
      s.barcode_value?.trim(),
  );
  const scanReference = verifiedScan?.barcode_value?.trim() ?? null;

  const reservationBlockers = buildReservationCreateBlockers({
    order,
    line,
    reservations,
    availabilitySummary,
  });

  const stockFinalizationHints = buildStockFinalizationHints({
    hasBalance: balance !== null,
    hasVerifiedScan: Boolean(scanReference),
    hasReservedLine: reservations.some(
      (r) => r.sku === line.sku && isReservationOpen(r.reservationStatus) && r.reservedQty > 0,
    ),
    locationCode,
  });

  return {
    order,
    lines: lines.length > 0 ? lines : [line],
    reservations,
    balance,
    locationCode,
    availability,
    availabilitySummary,
    hasVerifiedScan: Boolean(scanReference),
    scanReference,
    reservationBlockers,
    stockFinalizationHints,
  };
}

export function buildReservationCreateBlockers(params: {
  order: ReservationOrderRow;
  line: ReservationLineCandidate;
  reservations: InventoryReservationRecord[];
  availabilitySummary: ReturnType<typeof summarizeAvailability>;
}): string[] {
  const reasons: string[] = [];
  if (params.order.status !== "dispatched") {
    reasons.push(`Order must be dispatched (current: ${params.order.status}).`);
  }
  const activeForSku = params.reservations.filter(
    (r) => r.sku === params.line.sku && isReservationOpen(r.reservationStatus),
  );
  if (activeForSku.some((r) => r.reservationStatus === "reserved" || r.reservationStatus === "partially_reserved")) {
    reasons.push(`Active reservation already exists for SKU ${params.line.sku} on this order.`);
  }
  if (params.availabilitySummary.availableQty < params.line.quantity - 0.0001) {
    reasons.push(
      `Insufficient availability for ${params.line.sku}: need ${params.line.quantity}, available ${params.availabilitySummary.availableQty}.`,
    );
  }
  return reasons;
}

export function buildStockFinalizationHints(params: {
  hasBalance: boolean;
  hasVerifiedScan: boolean;
  hasReservedLine: boolean;
  locationCode: string;
}): string[] {
  const hints: string[] = [];
  if (!params.hasReservedLine) {
    hints.push("Create and reserve inventory before stock finalization (4G).");
  }
  if (!params.hasVerifiedScan) {
    hints.push("Record a verified carton/packing/gate scan on operational_scan_records (4G scanReference).");
  }
  if (!params.hasBalance) {
    hints.push(
      `Open initial stock balance at ${params.locationCode} before consumption finalize (staging helper below).`,
    );
  }
  return hints;
}

export const RESERVATION_BOARD_DEFAULT_LOCATION = DEFAULT_LOCATION;
