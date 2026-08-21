import { supabase } from "@/integrations/supabase/client";

/**
 * Temporary typed boundary for the P&A assembly-job governed RPCs added in
 * oasis-supabase-core (20260819120000) pending regenerated project-wide
 * Supabase definitions. Mirrors the rgsGovernedRpc escape hatch pattern
 * already used by RgsProductionDemandPlanner.tsx / ReadyGoodsStore.tsx for
 * the same reason -- these are real, deployed RPCs, just not yet in the
 * generated types.
 */
export const pnaAssemblyRpc = supabase as unknown as {
  rpc: <T = unknown>(fn: string, args?: Record<string, unknown>) => Promise<{ data: T | null; error: { message: string } | null }>;
};
