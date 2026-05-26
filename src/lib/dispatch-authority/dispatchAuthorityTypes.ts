export const DISPATCH_AUTHORITY_ACTIONS = [
  "dispatch:readiness_review",
  "dispatch:evidence_add",
  "dispatch:evidence_reject",
  "dispatch:gate_check",
  "dispatch:exception_create",
  "dispatch:exception_clear",
] as const;

export type DispatchAuthorityAction = (typeof DISPATCH_AUTHORITY_ACTIONS)[number];

export const DISPATCH_FORBIDDEN_ACTIONS = [
  "dispatch:complete",
  "dispatch:mark_dispatched",
  "dispatch:final_release",
] as const;

export type DispatchForbiddenAction = (typeof DISPATCH_FORBIDDEN_ACTIONS)[number];

export type DispatchAuthorityRole =
  | "SUPER_ADMIN"
  | "ADMIN"
  | "DISPATCH_MANAGER"
  | "DISPATCH_HEAD"
  | "DISPATCH_INCHARGE"
  | "OPERATIONS_MANAGER"
  | "OPS"
  | "FINANCE_HEAD"
  | "FINANCE_EXEC"
  | "UNKNOWN";

export interface DispatchAuthorityContext {
  actorRole: string;
  actorUserId: string;
  overrideReason?: string | null;
}

export interface DispatchAuthorityResult {
  allowed: boolean;
  reason: string;
}
