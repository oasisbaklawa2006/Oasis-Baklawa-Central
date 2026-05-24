import * as flags from "@/config/writeFeatureFlags";
import type { WriteActionKind } from "./writeActionKinds";
import { WRITE_AUTHORITY } from "./writeAuthorityMatrix";

/** Returns whether the compile-time flag for this action kind is enabled (default always false). */
export function isWriteFeatureEnabled(kind: WriteActionKind): boolean {
  const key = WRITE_AUTHORITY[kind].featureFlagKey;
  return flags.WRITE_FEATURE_FLAGS[key];
}

export function featureFlagSnapshot(): Record<keyof typeof flags.WRITE_FEATURE_FLAGS, boolean> {
  return { ...flags.WRITE_FEATURE_FLAGS };
}
