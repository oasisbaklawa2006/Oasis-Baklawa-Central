import { supabase } from "@/integrations/supabase/client";

/**
 * Temporary typed boundary for the governed b2b_dispatch_* RPCs added in
 * oasis-supabase-core (20260822140000, 20260822150000) pending regenerated
 * project-wide Supabase definitions. Mirrors the rgsGovernedRpc /
 * pnaAssemblyRpc escape hatch pattern already used elsewhere for the same
 * reason -- these are real, deployed RPCs, just not yet in the generated
 * types.
 */
export const dispatchGovernedRpc = supabase as unknown as {
  rpc: <T = unknown>(fn: string, args?: Record<string, unknown>) => Promise<{ data: T | null; error: { message: string } | null }>;
};
