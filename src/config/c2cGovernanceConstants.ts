/**
 * STATIC GOVERNANCE CONSTANTS — NON-EXECUTING.
 *
 * Labels and numeric targets for documentation and future tooling.
 * No environment reads, no imports from application runtime, no side effects.
 */

export const C2C_REPLAY_RETENTION_TARGET_SECONDS = 600;

export const C2C_AUDIT_RETENTION_TARGET_DAYS_STAGING = 180;

export const C2C_AUDIT_RETENTION_TARGET_DAYS_PRODUCTION_PILOT = 365;

export const C2C_STAGING_ISOLATION_LABEL = "STAGING_ISOLATED";

export const C2C_PRODUCTION_ISOLATION_LABEL = "PRODUCTION_BOUNDARY";

export const C2C_GOVERNANCE_STATE_LABELS = {
  FREEZE_ACTIVE: "freeze_active",
  STAGING_EXECUTION_BLOCKED: "staging_execution_blocked",
  DRY_RUN_DESIGN_ONLY: "dry_run_design_only",
  EVIDENCE_REQUIRED: "evidence_required",
} as const;

export const C2C_FREEZE_STATE_LABELS = {
  PRODUCTION_WRITE_FREEZE: "production_write_freeze",
  STAGING_EXECUTION_FREEZE: "staging_execution_freeze",
} as const;

export const C2C_SEVERITY_LABELS = {
  P0: "p0_blocker",
  P1: "p1_waiver_candidate",
  P2: "p2_non_blocking",
} as const;

export const C2C_EVIDENCE_STATE_LABELS = {
  MISSING: "missing",
  PLANNED: "planned",
  ATTACHED: "attached",
  VERIFIED: "verified",
  STALE: "stale",
} as const;
