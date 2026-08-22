import { supabase } from "@/integrations/supabase/client";

/**
 * Temporary typed boundary for complete_3pgs_order_item, added in
 * oasis-supabase-core (20260822120000) pending regenerated project-wide
 * Supabase definitions. Mirrors the rgsGovernedRpc / pnaAssemblyRpc /
 * dispatchGovernedRpc / threePgsProcurementRpc escape hatch pattern already
 * used elsewhere for the same reason -- this is a real, deployed RPC, just
 * not yet in the generated types.
 */
export const threePgsOrderItemRpc = supabase as unknown as {
  rpc: <T = unknown>(fn: string, args?: Record<string, unknown>) => Promise<{ data: T | null; error: { message: string } | null }>;
};
