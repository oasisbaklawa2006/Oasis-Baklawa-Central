import { supabase } from "@/integrations/supabase/client";

/**
 * Temporary typed boundary for the 3PGS procurement/vendor-shortage bridge
 * RPCs added in oasis-supabase-core (20260820100000) pending regenerated
 * project-wide Supabase definitions. Mirrors the rgsGovernedRpc /
 * pnaAssemblyRpc / dispatchGovernedRpc escape hatch pattern already used
 * elsewhere for the same reason -- these are real, deployed RPCs, just not
 * yet in the generated types.
 */
export const threePgsProcurementRpc = supabase as unknown as {
  rpc: <T = unknown>(fn: string, args?: Record<string, unknown>) => Promise<{ data: T | null; error: { message: string } | null }>;
};
