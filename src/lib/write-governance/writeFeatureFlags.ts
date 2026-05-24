/**
 * Re-exports compile-time write flags from `src/config/writeFeatureFlags.ts`.
 * Canonical values live in config so UI and edge policy can import one module.
 */
export {
  ENABLE_APPROVAL_REQUEST_WRITES,
  ENABLE_FACTORY_FOLLOWUP_WRITES,
  ENABLE_INVENTORY_HOLD_WRITES,
  ENABLE_MEDIA_METADATA_WRITES,
  ENABLE_NOTIFICATION_ACK_WRITES,
  ENABLE_RETAIL_RESERVATION_WRITES,
  WRITE_FEATURE_FLAGS,
  type WriteFeatureFlagKey,
} from "@/config/writeFeatureFlags";
