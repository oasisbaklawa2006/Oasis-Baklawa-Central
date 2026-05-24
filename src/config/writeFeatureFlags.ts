/**
 * Controlled write activation — all paths OFF until an explicit program enables them.
 * No environment reads; constants only. Persistence work must not ship with these true by default.
 */
export const ENABLE_RETAIL_RESERVATION_WRITES = false;
export const ENABLE_FACTORY_FOLLOWUP_WRITES = false;
export const ENABLE_MEDIA_METADATA_WRITES = false;
export const ENABLE_NOTIFICATION_ACK_WRITES = false;
export const ENABLE_INVENTORY_HOLD_WRITES = false;
export const ENABLE_APPROVAL_REQUEST_WRITES = false;

export const WRITE_FEATURE_FLAGS = {
  ENABLE_RETAIL_RESERVATION_WRITES,
  ENABLE_FACTORY_FOLLOWUP_WRITES,
  ENABLE_MEDIA_METADATA_WRITES,
  ENABLE_NOTIFICATION_ACK_WRITES,
  ENABLE_INVENTORY_HOLD_WRITES,
  ENABLE_APPROVAL_REQUEST_WRITES,
} as const;

export type WriteFeatureFlagKey = keyof typeof WRITE_FEATURE_FLAGS;
