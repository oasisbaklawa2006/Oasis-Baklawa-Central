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

const POST_DISPATCH_STAGES: GoldenChainStage[] = ["reservation", "stock_finalization", "complete"];

export function goldenChainPastDispatchFinalize(state: GoldenChainOrderState): boolean {
  return POST_DISPATCH_STAGES.includes(state.stage);
}

/** True when DB shows dispatch finalized but derivation still lists the finalize step. */
export function goldenChainDispatchFinalizeDrift(state: GoldenChainOrderState): boolean {
  if (state.stage !== "dispatch_finalization") return false;
  return ["dispatched", "in_transit", "delivered"].includes(
    state.orderStatus.trim().toLowerCase(),
  );
}

export function normalizeGoldenChainStateAfterDispatchFinalize(
  state: GoldenChainOrderState,
): GoldenChainOrderState {
  if (!goldenChainDispatchFinalizeDrift(state)) return state;
  return {
    ...state,
    stage: "reservation",
    cta: "Reserve stock",
  };
}

export function goldenChainReloadSatisfiedAfterDispatchFinalize(
  state: GoldenChainOrderState,
): boolean {
  return goldenChainPastDispatchFinalize(normalizeGoldenChainStateAfterDispatchFinalize(state));
}

export function goldenChainAdvancedPastDispatchFinalize(
  prev: GoldenChainOrderState,
  next: GoldenChainOrderState,
): boolean {
  if (prev.stage !== "dispatch_finalization") return false;
  return goldenChainReloadSatisfiedAfterDispatchFinalize(
    normalizeGoldenChainStateAfterDispatchFinalize(next),
  );
}
