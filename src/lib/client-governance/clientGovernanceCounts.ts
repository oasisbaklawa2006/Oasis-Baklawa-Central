import type { SupabaseClient } from "@supabase/supabase-js";

export type ClientGovernanceCounts = {
  pending: number;
  approved: number;
  active: number;
};

/** Authoritative KPI counts for Admin → Clients summary cards. */
export async function fetchClientGovernanceCounts(
  supabase: SupabaseClient,
): Promise<ClientGovernanceCounts> {
  const [pendingRes, approvedRes, activeRes] = await Promise.all([
    supabase.from("b2b_applications").select("id", { count: "exact", head: true }).eq("status", "pending"),
    supabase.from("b2b_applications").select("id", { count: "exact", head: true }).eq("status", "approved"),
    supabase.from("companies").select("id", { count: "exact", head: true }),
  ]);

  if (pendingRes.error) throw pendingRes.error;
  if (approvedRes.error) throw approvedRes.error;
  if (activeRes.error) throw activeRes.error;

  return {
    pending: pendingRes.count ?? 0,
    approved: approvedRes.count ?? 0,
    active: activeRes.count ?? 0,
  };
}
