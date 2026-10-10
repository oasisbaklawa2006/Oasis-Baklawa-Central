import { supabase } from "@/integrations/supabase/client";

/**
 * Canonical read-only boundary for Core `b2b_assembly_jobs` authority.
 * Assembly TV and other read surfaces must consume jobs through this module
 * rather than order_items production_status projections.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const assemblyReadDb = supabase as unknown as { from: (relation: string) => any };

export type AssemblyJobTvRow = {
  id: string;
  assembly_job_number: string;
  order_id: string;
  output_product_id: string;
  output_sku: string;
  planned_qty: number;
  completed_qty: number;
  accepted_qty: number;
  rejected_qty: number;
  status: string;
  created_at: string;
};

export const ASSEMBLY_JOB_TV_SELECT =
  "id, assembly_job_number, order_id, output_product_id, output_sku, planned_qty, completed_qty, accepted_qty, rejected_qty, status, created_at";

export const ASSEMBLY_TERMINAL_STATUSES = new Set(["job_closed", "cancelled"]);
export const ASSEMBLY_TV_DISPLAY_LIMIT = 200;
export const ASSEMBLY_TV_REFRESH_MS = 30000;

export const ASSEMBLY_TV_READY_STATUSES = new Set(["accepted", "partially_accepted", "job_completed"]);
export const ASSEMBLY_TV_PARTIAL_STATUSES = new Set([
  "partially_reserved",
  "in_progress",
  "qc_pending",
  "reconciliation_pending",
]);
export const ASSEMBLY_TV_PENDING_STATUSES = new Set([
  "planned",
  "materials_reserved",
  "issued",
  "rejected",
]);

export type AssemblyTvColumn = "ready" | "partial" | "pending";

export function classifyAssemblyJobForTvColumn(status: string): AssemblyTvColumn {
  if (ASSEMBLY_TV_READY_STATUSES.has(status)) return "ready";
  if (ASSEMBLY_TV_PARTIAL_STATUSES.has(status)) return "partial";
  if (ASSEMBLY_TV_PENDING_STATUSES.has(status)) return "pending";
  return "pending";
}

export function assemblyJobTvProgress(job: AssemblyJobTvRow): { numerator: number; denominator: number; pct: number } {
  const planned = Number(job.planned_qty);
  const column = classifyAssemblyJobForTvColumn(job.status);
  const numerator = column === "ready"
    ? Number(job.accepted_qty)
    : column === "partial"
      ? Number(job.completed_qty)
      : 0;
  const denominator = planned > 0 ? planned : 0;
  const pct = denominator > 0 ? Math.min(100, Math.round((numerator / denominator) * 100)) : 0;
  return { numerator, denominator, pct };
}

export function isActiveAssemblyJob(status: string): boolean {
  return !ASSEMBLY_TERMINAL_STATUSES.has(status);
}

export async function fetchAssemblyJobsForTv(limit = ASSEMBLY_TV_DISPLAY_LIMIT): Promise<AssemblyJobTvRow[]> {
  const result = await assemblyReadDb
    .from("b2b_assembly_jobs")
    .select(ASSEMBLY_JOB_TV_SELECT)
    .not("status", "in", "(job_closed,cancelled)")
    .order("created_at", { ascending: false })
    .limit(limit);
  if (result.error) throw result.error;
  return (result.data ?? []) as AssemblyJobTvRow[];
}

export async function fetchProductNamesForAssemblyTv(
  productIds: string[],
): Promise<Record<string, { name: string; sku: string | null }>> {
  if (!productIds.length) return {};
  const result = await supabase.from("products").select("id, name, sku").in("id", productIds);
  if (result.error) throw result.error;
  return Object.fromEntries(
    ((result.data ?? []) as Array<{ id: string; name: string; sku: string | null }>).map((product) => [
      product.id,
      { name: product.name, sku: product.sku },
    ]),
  );
}
