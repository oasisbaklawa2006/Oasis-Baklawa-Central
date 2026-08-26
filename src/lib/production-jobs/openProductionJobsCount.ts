import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * Authoritative "open" statuses for a governed production_jobs row -- a job
 * still has outstanding work if it hasn't reached a terminal state.
 * Mirrors the status set OperationsController.tsx already treats as live
 * (see its production_jobs `.in("status", ...)` read).
 */
export const OPEN_PRODUCTION_JOB_STATUSES = [
  "pending",
  "accepted",
  "in_production",
  "paused",
] as const;

export interface OpenProductionJobsCountResult {
  /** null = query failed or hasn't resolved yet -- never coerce to 0. */
  count: number | null;
  error: string | null;
}

/**
 * Counts open production_jobs rows -- the real, governed production
 * authority (assigned by RGS shortage/demand planning, tracked to
 * completion). This is intentionally a separate, independent read from
 * `productionQueueFeed` (which counts legacy `orders.status` pipeline
 * membership) so the two numbers are never conflated under one label.
 */
export async function fetchOpenProductionJobsCount(
  client: SupabaseClient,
): Promise<OpenProductionJobsCountResult> {
  try {
    const { count, error } = await client
      .from("production_jobs")
      .select("id", { count: "exact", head: true })
      .in("status", [...OPEN_PRODUCTION_JOB_STATUSES]);

    if (error) {
      return { count: null, error: error.message ?? "production_jobs count query failed" };
    }
    return { count: count ?? 0, error: null };
  } catch (err) {
    return { count: null, error: err instanceof Error ? err.message : "production_jobs count query failed" };
  }
}
