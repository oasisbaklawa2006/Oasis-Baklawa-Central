import { supabase } from "@/integrations/supabase/client";

/**
 * Temporary typed boundary for the RGS/Production governed RPCs added in
 * oasis-supabase-core (20260817090000-20260817130000) pending regenerated
 * project-wide Supabase definitions. Mirrors the `operationsDb` escape
 * hatch pattern already used by ReadyGoodsStore.tsx / InventoryReceiving.tsx
 * for the same reason -- these are real, deployed RPCs, just not yet in the
 * generated types.
 *
 * Supabase's rpc() returns a PostgrestFilterBuilder: it is awaitable/thenable,
 * but it is not a native Promise and therefore does not implement `.catch()`.
 * Normalize that thenable to a real Promise here so callers can safely use
 * either `await rgsGovernedRpc.rpc(...)` or best-effort `.catch(...)` handling.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const rgsGovernedRpc = {
  rpc: (fn: string, args?: Record<string, unknown>): Promise<{ data: any; error: { message: string } | null }> =>
    Promise.resolve(
      (supabase as unknown as { rpc: (name: string, params?: Record<string, unknown>) => PromiseLike<{ data: any; error: { message: string } | null }> })
        .rpc(fn, args),
    ),
};
