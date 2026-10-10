/**
 * Point 76 — blocks client-only partial/split mutations that create shadow
 * order lines, mutate canonical quantities, or bypass Core authority.
 */

export const LEGACY_PARTIAL_SPLIT_MUTATION_MESSAGE =
  "Partial and split fulfilment is governed only via canonical Core facts/RPCs. Client-side quantity splits, shadow child order lines, and direct production mutations are disabled.";

export interface LegacyPartialSplitBlockResult {
  blocked: true;
  message: string;
  code: "LEGACY_PARTIAL_SPLIT_BLOCKED";
}

export function blockLegacyPartialSplitMutation(source: string): LegacyPartialSplitBlockResult {
  return {
    blocked: true,
    code: "LEGACY_PARTIAL_SPLIT_BLOCKED",
    message: `${LEGACY_PARTIAL_SPLIT_MUTATION_MESSAGE} (source: ${source})`,
  };
}

/** True when a handler would mutate order_items.quantity or insert shadow fulfilment rows. */
export function isShadowOrderLineSplitMutation(target: {
  mutatesOrderItemQuantity?: boolean;
  insertsShadowOrderItem?: boolean;
  mutatesFactoryInventory?: boolean;
  adjustmentType?: string;
}): boolean {
  if (target.insertsShadowOrderItem) return true;
  if (target.mutatesOrderItemQuantity) return true;
  if (target.mutatesFactoryInventory && target.adjustmentType === "smart_fulfillment") return true;
  return false;
}
