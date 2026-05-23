/**
 * ALL FLAGS HARD-DISABLED — GOVERNANCE FREEZE ACTIVE.
 *
 * Static scaffold only: no environment reads, no imports, no side effects.
 * Do not wire these flags into runtime paths until governance GO + evidence exist.
 * Any future import site must default to this object unchanged in freeze phase.
 */

export const C2C_EXECUTION_FLAGS = {
  ENABLE_REAL_SENDS: false,
  ENABLE_STAGING_SENDS: false,
  ENABLE_QUEUE_PROCESSING: false,
  ENABLE_QUEUE_SHADOW: false,
  ENABLE_RETRIES: false,
  ENABLE_DISPATCH_WRITES: false,
  ENABLE_FINANCE_WRITES: false,
  ENABLE_TOOL5_WRITES: false,
  ENABLE_DRY_RUN_EXECUTION: false,
  ENABLE_SHADOW_WRITES: false,
  ENABLE_REPLAY_SIMULATION: false,
  ENABLE_MOCK_TRANSPORT: false,
  ENABLE_AUDIT_MIRROR_RUNTIME: false,
  ENABLE_AUTOMATION_AUTHORITY: false,
  ENABLE_OPERATOR_REPLY_EXECUTION: false,
  ENABLE_CLASSIFY_EXECUTE: false,
  ENABLE_ROUTE_EXECUTE: false,
} as const;

export type C2CExecutionFlagKey = keyof typeof C2C_EXECUTION_FLAGS;
