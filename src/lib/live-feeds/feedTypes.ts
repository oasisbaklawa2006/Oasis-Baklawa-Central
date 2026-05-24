import type { QueueItemBuildInput } from "@/lib/work-queues/queueProjection";

export type FeedFreshness = "live" | "stale" | "unavailable" | "partial";

/** Bounded War Room order row — read-only feed input (no writes). */
export interface OperationalOrderFeedRow {
  id: string;
  status: string;
  payment_status?: string | null;
  advance_paid?: number | null;
  advance_required?: number | null;
  created_at: string | null;
  sales_order_value?: number | null;
  dispatch_urgency?: string | null;
  company_id?: string | null;
  company_name?: string;
  company_status?: string | null;
  needs_clarification?: boolean | null;
  is_duplicate?: boolean | null;
  has_complaint?: boolean;
  min_confidence?: number | null;
}

export interface OperationalFeedContext {
  orders: OperationalOrderFeedRow[];
  loadedAt: string;
  orderQueryError?: string | null;
  factoryInventoryCount?: number | null;
  factoryInventoryError?: string | null;
  scanAnomalyCount?: number | null;
  reservationRiskCount?: number | null;
}

export interface LiveFeedResult {
  items: QueueItemBuildInput[];
  /** Null unless explicitly set by a trusted feed — never derived from items.length. */
  pressureCount: number | null;
  freshness: FeedFreshness;
  source: string;
  warnings: string[];
  lastLoadedAt: string;
}

export function emptyFeedResult(source: string, warning?: string): LiveFeedResult {
  const now = new Date().toISOString();
  return {
    items: [],
    pressureCount: null,
    freshness: "unavailable",
    source,
    warnings: warning ? [warning] : ["Feed unavailable"],
    lastLoadedAt: now,
  };
}

export function successFeedResult(
  source: string,
  items: QueueItemBuildInput[],
  pressureCount: number | null,
  freshness: FeedFreshness = "live",
  warnings: string[] = [],
): LiveFeedResult {
  return {
    items,
    pressureCount,
    freshness,
    source,
    warnings,
    lastLoadedAt: new Date().toISOString(),
  };
}
