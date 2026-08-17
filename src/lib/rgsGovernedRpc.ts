import { supabase } from "@/integrations/supabase/client";

/**
 * Temporary typed boundary for the RGS/Production governed RPCs added in
 * oasis-supabase-core (20260817090000-20260817130000) pending regenerated
 * project-wide Supabase definitions. Mirrors the `operationsDb` escape
 * hatch pattern already used by ReadyGoodsStore.tsx / InventoryReceiving.tsx
 * for the same reason -- these are real, deployed RPCs, just not yet in the
 * generated types.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const rgsGovernedRpc = supabase as unknown as { rpc: (fn: string, args?: Record<string, unknown>) => Promise<{ data: any; error: { message: string } | null }> };
