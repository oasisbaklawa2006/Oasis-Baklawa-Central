import { supabase } from "@/integrations/supabase/client";

type GovernedRpcResult = {
  data: Record<string, unknown> | null;
  error: { message: string } | null;
};

type GovernedRpcClient = {
  rpc: (name: string, params?: Record<string, unknown>) => PromiseLike<GovernedRpcResult>;
};

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
 * The async wrapper normalizes that thenable to a native Promise and also
 * turns any synchronous invocation failure into a rejected Promise.
 */
const governedRpcClient = supabase as unknown as GovernedRpcClient;

export const rgsGovernedRpc = {
  async rpc(fn: string, args?: Record<string, unknown>): Promise<GovernedRpcResult> {
    return await governedRpcClient.rpc(fn, args);
  },
};

export { classifyGovernedRpcFailure, requireGovernedRpcSuccess } from "@/lib/integration-contracts";
