import { supabase } from "@/integrations/supabase/client";
import {
  EMPTY_CENTRAL_ORDER_POOL_SNAPSHOT,
  isPackingStatus,
  isProductionStatus,
  type CentralOrderPoolSnapshot,
} from "@/lib/centralOrderPool/centralOrderPoolModel";

export type CentralOrderPoolSnapshotLoadResult = {
  snapshot: CentralOrderPoolSnapshot;
  error: string | null;
};

async function countSuggestedOrders(status: string): Promise<number> {
  const { count, error } = await supabase
    .from("suggested_orders")
    .select("id", { count: "exact", head: true })
    .eq("status", status);
  if (error) throw error;
  return count ?? 0;
}

async function countOrdersInStatuses(statuses: string[]): Promise<number> {
  if (statuses.length === 0) return 0;
  const { count, error } = await supabase
    .from("orders")
    .select("id", { count: "exact", head: true })
    .in("status", statuses);
  if (error) throw error;
  return count ?? 0;
}

async function loadRecentOrders(): Promise<CentralOrderPoolSnapshot["recentOrders"]> {
  const { data, error } = await supabase
    .from("orders")
    .select("id, order_number, status, created_at, company:companies(business_name)")
    .neq("status", "draft")
    .order("created_at", { ascending: false })
    .limit(8);
  if (error) throw error;

  return (data ?? []).map((row) => ({
    id: row.id,
    order_number: row.order_number,
    status: row.status,
    created_at: row.created_at,
    company_name: companyNameFromOrderRelation(row.company),
  }));
}

/** Supabase infers `company:companies(...)` as a collection relation. */
export function companyNameFromOrderRelation(company: unknown): string | null {
  if (!company) return null;
  if (Array.isArray(company)) {
    return company[0]?.business_name ?? null;
  }
  if (typeof company === "object" && "business_name" in company) {
    const name = (company as { business_name?: string | null }).business_name;
    return name ?? null;
  }
  return null;
}

export async function loadCentralOrderPoolSnapshot(): Promise<CentralOrderPoolSnapshotLoadResult> {
  try {
    const [
      intakePending,
      intakeClarification,
      pipelineSubmitted,
      pipelineConfirmed,
      productionActive,
      packingActive,
      recentOrders,
    ] = await Promise.all([
      countSuggestedOrders("pending_review"),
      countSuggestedOrders("needs_clarification"),
      countOrdersInStatuses(["submitted"]),
      countOrdersInStatuses(["approved", "awaiting_advance"]),
      countOrdersInStatuses(["confirmed", "manufacturing", "in_production", "assembled"]),
      countOrdersInStatuses(["packing", "packed_ready", "awaiting_final_payment", "cleared_for_dispatch", "dispatched"]),
      loadRecentOrders(),
    ]);

    return {
      snapshot: {
        intakePending,
        intakeClarification,
        pipelineSubmitted,
        pipelineConfirmed,
        productionActive,
        packingActive,
        recentOrders,
      },
      error: null,
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to load Central Order Pool snapshot";
    return {
      snapshot: EMPTY_CENTRAL_ORDER_POOL_SNAPSHOT,
      error: message,
    };
  }
}

export function applyCentralOrderPoolSnapshotLoadResult(
  previous: CentralOrderPoolSnapshot,
  result: CentralOrderPoolSnapshotLoadResult,
): CentralOrderPoolSnapshot {
  if (result.error) return previous;
  return result.snapshot;
}

/** Test helpers for status bucketing without live Supabase. */
export function bucketOrderStatusCounts(statuses: string[]) {
  let productionActive = 0;
  let packingActive = 0;
  for (const status of statuses) {
    if (isProductionStatus(status)) productionActive += 1;
    if (isPackingStatus(status)) packingActive += 1;
  }
  return { productionActive, packingActive };
}
