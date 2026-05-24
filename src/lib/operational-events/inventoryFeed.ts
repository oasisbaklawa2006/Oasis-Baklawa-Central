import { dedupeOperationalEventsById } from "./normalize";
import { InventoryOperationalEventKind, type OperationalEventRecord } from "./types";
import type { InventoryVisibilitySource, ReadyGoodsVisibilityRow, StoreOutletSummary } from "@/lib/inventory/readyGoodsVisibility";

const SOURCE = "derived_inventory_visibility" as const;

function productEntity(id: string): OperationalEventRecord["entities"] {
  return [{ entityType: "product", id }];
}

function storeEntity(id: string): OperationalEventRecord["entities"] {
  return [{ entityType: "store", id }];
}

export interface InventoryOperationalFeedInput {
  rows: ReadyGoodsVisibilityRow[];
  outletSummaries: StoreOutletSummary[];
  fetchError: string | null;
  /** Declared upstream read source for labeling (never invented). */
  declaredSource: InventoryVisibilitySource;
  nowMs: number;
}

/**
 * Read-only inventory visibility projections for timelines.
 * Snapshot rows use occurredAt = null.
 */
export function buildInventoryOperationalFeed(input: InventoryOperationalFeedInput): OperationalEventRecord[] {
  let sortKey = 2000;
  const next = () => sortKey++;
  const actor: OperationalEventRecord["actor"] = { role: "system", displayLabel: "Inventory visibility" };
  const out: OperationalEventRecord[] = [];

  void input.nowMs;

  if (input.fetchError) {
    out.push({
      id: "inv:feed:fetch_error",
      kind: InventoryOperationalEventKind.READY_GOODS_PENDING,
      category: "operational",
      severity: "warning",
      title: "Inventory read unavailable",
      detail: input.fetchError,
      occurredAt: null,
      sortKey: next(),
      actor,
      entities: [],
      source: SOURCE,
    });
    return dedupeOperationalEventsById(out);
  }

  if (input.rows.length === 0) {
    out.push({
      id: "inv:feed:no_rows",
      kind: InventoryOperationalEventKind.READY_GOODS_PENDING,
      category: "operational",
      severity: "warning",
      title: "Ready goods data pending",
      detail:
        "No factory_inventory rows were returned for this snapshot. Per-outlet shelf stock is still not modeled — verify manually with stores.",
      occurredAt: null,
      sortKey: next(),
      actor,
      entities: [],
      source: SOURCE,
    });
  } else {
    out.push({
      id: "inv:feed:visibility_available",
      kind: InventoryOperationalEventKind.VISIBILITY_AVAILABLE,
      category: "operational",
      severity: "info",
      title: "Inventory visibility snapshot",
      detail: `Source · ${input.declaredSource} · Rows · ${input.rows.length} (factory SKU level — not branch shelf truth).`,
      occurredAt: null,
      sortKey: next(),
      actor,
      entities: [],
      source: SOURCE,
    });
  }

  for (const s of input.outletSummaries) {
    if (s.rowCount === 0) {
      out.push({
        id: `inv:outlet:${s.outletId}:unknown`,
        kind: InventoryOperationalEventKind.VISIBILITY_UNKNOWN,
        category: "operational",
        severity: "warning",
        title: `No linked SKUs · ${s.outletName}`,
        detail: "No factory_inventory rows matched this outlet via product default_store. Shelf truth still requires manual verification.",
        occurredAt: null,
        sortKey: next(),
        actor,
        entities: storeEntity(s.outletId),
        source: SOURCE,
      });
      continue;
    }

    if (s.confidence === "manual_verification_required") {
      out.push({
        id: `inv:outlet:${s.outletId}:manual`,
        kind: InventoryOperationalEventKind.MANUAL_VERIFICATION_REQUIRED,
        category: "escalation",
        severity: "warning",
        title: `Manual verification · ${s.outletName}`,
        detail: `Rows ${s.rowCount} · all quantities unknown or null in source.`,
        occurredAt: null,
        sortKey: next(),
        actor,
        entities: storeEntity(s.outletId),
        source: SOURCE,
      });
    } else if (s.confidence === "partial") {
      out.push({
        id: `inv:outlet:${s.outletId}:partial`,
        kind: InventoryOperationalEventKind.VISIBILITY_UNKNOWN,
        category: "operational",
        severity: "warning",
        title: `Partial visibility · ${s.outletName}`,
        detail: `Known qty rows ${s.knownQtyCount} · unknown ${s.unknownQtyCount}`,
        occurredAt: null,
        sortKey: next(),
        actor,
        entities: storeEntity(s.outletId),
        source: SOURCE,
      });
    } else {
      out.push({
        id: `inv:outlet:${s.outletId}:ok`,
        kind: InventoryOperationalEventKind.VISIBILITY_AVAILABLE,
        category: "operational",
        severity: "info",
        title: `Numeric snapshot · ${s.outletName}`,
        detail: `Rows ${s.rowCount} · max known qty ${s.maxKnownQty ?? "—"} (factory row — confirm before customer promise).`,
        occurredAt: null,
        sortKey: next(),
        actor,
        entities: storeEntity(s.outletId),
        source: SOURCE,
      });
    }

    if (s.lowStockCount > 0) {
      out.push({
        id: `inv:outlet:${s.outletId}:low`,
        kind: InventoryOperationalEventKind.LOW_STOCK_WARNING,
        category: "escalation",
        severity: "urgent",
        title: `Low factory qty signal · ${s.outletName}`,
        detail: `${s.lowStockCount} SKU(s) at or below the low threshold on factory_inventory rows (not shelf-level).`,
        occurredAt: null,
        sortKey: next(),
        actor,
        entities: storeEntity(s.outletId),
        source: SOURCE,
      });
    }
  }

  for (const r of input.rows) {
    if (r.quantityKnown && r.quantity != null && r.quantity <= 5) {
      out.push({
        id: `inv:sku:${r.productId}:low`,
        kind: InventoryOperationalEventKind.LOW_STOCK_WARNING,
        category: "escalation",
        severity: "warning",
        title: `Low qty · ${r.productName}`,
        detail: `Qty ${r.quantity} · outlet group · ${r.outletLabel}`,
        occurredAt: null,
        sortKey: next(),
        actor,
        entities: productEntity(r.productId),
        source: SOURCE,
      });
    }
  }

  return dedupeOperationalEventsById(out);
}

export function normalizeInventoryOperationalEvents(events: OperationalEventRecord[]): OperationalEventRecord[] {
  return dedupeOperationalEventsById(events);
}
