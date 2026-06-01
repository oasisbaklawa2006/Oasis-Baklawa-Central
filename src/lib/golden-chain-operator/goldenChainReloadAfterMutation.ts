import type { SupabaseClient } from "@supabase/supabase-js";
import { loadGoldenChainOrderState } from "./goldenChainOrderQueries";
import type { GoldenChainOrderState, GoldenChainStage } from "./goldenChainTypes";

export type GoldenChainReloadPredicate = (state: GoldenChainOrderState) => boolean;

/** Re-read order governance slices until post-mutation state is visible (Supabase read-after-write). */
export async function reloadGoldenChainOrderWithRetry(
  client: SupabaseClient,
  orderId: string,
  predicate: GoldenChainReloadPredicate,
  options?: { maxAttempts?: number; delayMs?: number },
): Promise<GoldenChainOrderState> {
  const maxAttempts = options?.maxAttempts ?? 10;
  const delayMs = options?.delayMs ?? 350;

  let state = await loadGoldenChainOrderState(client, orderId);
  for (let attempt = 1; attempt < maxAttempts && !predicate(state); attempt += 1) {
    await new Promise((resolve) => setTimeout(resolve, delayMs));
    state = await loadGoldenChainOrderState(client, orderId);
  }
  return state;
}

export function goldenChainPastDispatchFinalize(
  state: GoldenChainOrderState,
  stages: GoldenChainStage[] = ["reservation", "stock_finalization", "complete"],
): boolean {
  if (stages.includes(state.stage)) return true;
  return (
    state.dispatchAlreadyFinalized &&
    ["dispatched", "in_transit", "delivered"].includes(state.orderStatus.trim().toLowerCase())
  );
}

export function goldenChainAdvancedPastDispatchFinalize(
  prev: GoldenChainOrderState,
  next: GoldenChainOrderState,
): boolean {
  if (prev.stage !== "dispatch_finalization") return false;
  if (next.stage === "reservation") return true;
  return goldenChainPastDispatchFinalize(next);
}
