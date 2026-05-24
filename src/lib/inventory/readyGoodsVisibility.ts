/**
 * Read-only ready-goods / inventory visibility helpers.
 * No network, no Supabase — callers fetch data and pass rows in.
 */

export type InventoryVisibilitySource =
  | "factory_inventory"
  | "derived_production_minus_dispatch"
  | "inventory_items_table"
  | "none";

export type ReadyGoodsRiskLevel = "unknown" | "low" | "medium" | "high";

export interface ReadyGoodsVisibilityRow {
  productId: string;
  productName: string;
  sku: string | null;
  /** Display label for grouping (e.g. outlet name or "Unassigned"). */
  outletLabel: string;
  quantity: number | null;
  quantityKnown: boolean;
  source: InventoryVisibilitySource;
  lastUpdatedAt: string | null;
}

export type StoreStockConfidence =
  | "unknown"
  | "partial"
  | "verified_numeric"
  | "manual_verification_required";

export interface StoreOutletSummary {
  outletId: string;
  outletName: string;
  rowCount: number;
  knownQtyCount: number;
  unknownQtyCount: number;
  lowStockCount: number;
  confidence: StoreStockConfidence;
  /** Max quantity among known rows (informational only; not shelf-level truth). */
  maxKnownQty: number | null;
}

const LOW_STOCK_THRESHOLD = 5;

export function normalizeReadyGoodsRows(
  rows: Array<{
    productId: string;
    productName: string;
    sku: string | null;
    outletLabel: string;
    quantity: number | null;
    source: InventoryVisibilitySource;
    lastUpdatedAt?: string | null;
  }>,
): ReadyGoodsVisibilityRow[] {
  return rows.map((r) => {
    const q = r.quantity;
    const known = q != null && typeof q === "number" && !Number.isNaN(q);
    return {
      productId: r.productId,
      productName: r.productName,
      sku: r.sku,
      outletLabel: (r.outletLabel || "Unassigned").trim() || "Unassigned",
      quantity: known ? q! : null,
      quantityKnown: known,
      source: r.source,
      lastUpdatedAt: r.lastUpdatedAt ?? null,
    };
  });
}

export function groupReadyGoodsByStore(rows: ReadyGoodsVisibilityRow[]): Map<string, ReadyGoodsVisibilityRow[]> {
  const m = new Map<string, ReadyGoodsVisibilityRow[]>();
  for (const r of rows) {
    const key = r.outletLabel;
    if (!m.has(key)) m.set(key, []);
    m.get(key)!.push(r);
  }
  for (const list of m.values()) {
    list.sort((a, b) => a.productName.localeCompare(b.productName));
  }
  return m;
}

function confidenceForRows(rows: ReadyGoodsVisibilityRow[]): StoreStockConfidence {
  if (rows.length === 0) return "unknown";
  const known = rows.filter((r) => r.quantityKnown).length;
  const unknown = rows.length - known;
  if (known === 0) return "manual_verification_required";
  if (unknown > 0) return "partial";
  return "verified_numeric";
}

export function deriveStoreStockConfidence(
  outletSummaries: Array<{ outletId: string; outletName: string }>,
  outletNameToRows: Map<string, ReadyGoodsVisibilityRow[]>,
): Map<string, StoreOutletSummary> {
  const out = new Map<string, StoreOutletSummary>();

  for (const o of outletSummaries) {
    const list = outletNameToRows.get(o.outletName) ?? [];
    let lowStockCount = 0;
    let maxKnown: number | null = null;
    for (const r of list) {
      if (r.quantityKnown && r.quantity != null) {
        if (r.quantity <= LOW_STOCK_THRESHOLD) lowStockCount += 1;
        maxKnown = maxKnown == null ? r.quantity : Math.max(maxKnown, r.quantity);
      }
    }
    const conf = confidenceForRows(list);
    out.set(o.outletId, {
      outletId: o.outletId,
      outletName: o.outletName,
      rowCount: list.length,
      knownQtyCount: list.filter((r) => r.quantityKnown).length,
      unknownQtyCount: list.filter((r) => !r.quantityKnown).length,
      lowStockCount,
      confidence: list.length === 0 ? "unknown" : conf,
      maxKnownQty: maxKnown,
    });
  }

  return out;
}

export interface InventoryVisibilitySummary {
  totalRows: number;
  knownQtyRows: number;
  unknownQtyRows: number;
  outletsWithData: number;
  primarySource: InventoryVisibilitySource;
}

export function buildInventoryVisibilitySummary(
  rows: ReadyGoodsVisibilityRow[],
  outletSummaries: Array<{ outletId: string; outletName: string }>,
  outletNameToRows: Map<string, ReadyGoodsVisibilityRow[]>,
): InventoryVisibilitySummary {
  let known = 0;
  let unknown = 0;
  let outletsWithData = 0;
  const sources = new Set<InventoryVisibilitySource>();
  for (const r of rows) {
    if (r.quantityKnown) known += 1;
    else unknown += 1;
    sources.add(r.source);
  }
  for (const o of outletSummaries) {
    const n = (outletNameToRows.get(o.outletName) ?? []).length;
    if (n > 0) outletsWithData += 1;
  }
  const primarySource: InventoryVisibilitySource = sources.has("factory_inventory")
    ? "factory_inventory"
    : sources.has("inventory_items_table")
      ? "inventory_items_table"
      : sources.has("derived_production_minus_dispatch")
        ? "derived_production_minus_dispatch"
        : "none";

  return {
    totalRows: rows.length,
    knownQtyRows: known,
    unknownQtyRows: unknown,
    outletsWithData,
    primarySource,
  };
}

/** Match `products.default_store` text to a canonical outlet display name (best-effort). */
export function matchOutletDisplayName(
  defaultStore: string | null | undefined,
  outletNames: string[],
): string | null {
  const raw = (defaultStore || "").trim().toLowerCase();
  if (!raw) return null;
  if (raw === "ready_goods" || raw.includes("ready good")) {
    return "Ready goods (central)";
  }
  for (const name of outletNames) {
    const n = name.trim().toLowerCase();
    if (raw === n) return name;
    if (raw.includes(n) || n.includes(raw)) return name;
  }
  return null;
}
