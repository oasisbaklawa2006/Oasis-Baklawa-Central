import type { WriteActionKind } from "./writeActionKinds";
import type { WriteFeatureFlagKey } from "@/config/writeFeatureFlags";

/** Deployment surface allowed for a write kind before activation. */
export type WriteAllowedEnvironment = "development" | "staging" | "production";

/** How a write would be reversed if persistence existed (documentation / routing). */
export type WriteRollbackKind = "soft_delete" | "compensating_movement" | "state_revert" | "none";

export type WriteActorRole =
  | "store_operator"
  | "inventory_controller"
  | "dispatch"
  | "finance"
  | "cmd"
  | "super_admin"
  | "system";

export interface WriteActionAuthority {
  kind: WriteActionKind;
  /** Minimum role label for policy matrix — runtime ACL is out of scope here. */
  requiredRole: WriteActorRole;
  requiresHumanConfirmation: boolean;
  requiresAudit: boolean;
  requiresIdempotencyKey: boolean;
  rollbackKind: WriteRollbackKind;
  /** Where this write may eventually be enabled (policy); does not enable anything. */
  allowedEnvironments: WriteAllowedEnvironment[];
  /** Maps to `WRITE_FEATURE_FLAGS` — must be true before any adapter performs I/O. */
  featureFlagKey: WriteFeatureFlagKey;
}
