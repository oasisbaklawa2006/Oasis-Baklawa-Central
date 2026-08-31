import { supabase } from "@/integrations/supabase/client";

/**
 * Temporary typed boundary for the governed b2b_dispatch_* RPCs added in
 * oasis-supabase-core (20260822140000, 20260822150000, 20260830110000,
 * 20260830120000) pending regenerated project-wide Supabase definitions.
 * Mirrors the rgsGovernedRpc / pnaAssemblyRpc escape hatch pattern already
 * used elsewhere for the same reason -- these are real, deployed RPCs, just
 * not yet in the generated types.
 */
export const dispatchGovernedRpc = supabase as unknown as {
  rpc: <T = unknown>(fn: string, args?: Record<string, unknown>) => Promise<{ data: T | null; error: { message: string } | null }>;
};

/**
 * Same escape hatch for reading the governed b2b_dispatch_* tables/views
 * directly (SELECT is already granted to internal staff by RLS; only
 * INSERT/UPDATE/DELETE are RPC-gated) -- their row shapes aren't in the
 * generated types yet either. A minimal generic query-builder type keeps
 * the chain typed by row shape while still deferring to database.types.ts
 * once these relations are generated.
 */
type DispatchQuery<Row> = PromiseLike<{ data: Row[] | null; error: { message: string } | null }> & {
  select: (columns: string) => DispatchQuery<Row>;
  eq: (column: string, value: unknown) => DispatchQuery<Row>;
  order: (column: string, options?: { ascending?: boolean }) => DispatchQuery<Row>;
  limit: (count: number) => DispatchQuery<Row>;
};

export const dispatchDb = supabase as unknown as {
  from: <Row = Record<string, unknown>>(relation: string) => DispatchQuery<Row>;
};
