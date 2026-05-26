import type { StockFinalizationWriteContext } from "./stockFinalizationTypes";
import { StockFinalizationError } from "./stockFinalizationTypes";

export function requireReversalReason(ctx: StockFinalizationWriteContext): void {
  if (!ctx.reversalReason?.trim()) {
    throw new StockFinalizationError("reason_required", "Stock reversal requires typed reversalReason");
  }
}

export function buildReversalCompensatingMetadata(params: {
  orderId: string;
  originalMovementId: string | null;
  restoreQty: number;
  reason: string;
}) {
  return {
    orderId: params.orderId,
    compensating: true,
    originalMovementId: params.originalMovementId,
    restoreQty: params.restoreQty,
    reason: params.reason,
    silentAdjustment: false,
  };
}
