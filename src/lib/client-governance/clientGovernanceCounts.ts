import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";

export interface ClientGovernanceCounts {
  pending: number;
  approved: number;
  active: number;
}

export interface ClientGovernanceCountsResult {
  counts: ClientGovernanceCounts | null;
  error: string | null;
}

/**
 * Authoritative summary counters for Admin → Client Governance KPI cards.
 * Queries b2b_applications (pending/approved) and companies (active directory)
 * independently from tab list reads so list and KPI can converge after mutations.
 */
export async function fetchClientGovernanceCounts(
  client: SupabaseClient<Database>,
): Promise<ClientGovernanceCountsResult> {
  try {
    const [pendingRes, approvedRes, activeRes] = await Promise.all([
      client.from("b2b_applications").select("id", { count: "exact", head: true }).eq("status", "pending"),
      client.from("b2b_applications").select("id", { count: "exact", head: true }).eq("status", "approved"),
      client.from("companies").select("id", { count: "exact", head: true }),
    ]);

    const firstError = pendingRes.error ?? approvedRes.error ?? activeRes.error;
    if (firstError) {
      return { counts: null, error: firstError.message ?? "client governance count query failed" };
    }

    return {
      counts: {
        pending: pendingRes.count ?? 0,
        approved: approvedRes.count ?? 0,
        active: activeRes.count ?? 0,
      },
      error: null,
    };
  } catch (err) {
    return {
      counts: null,
      error: err instanceof Error ? err.message : "client governance count query failed",
    };
  }
}
