export type DispatchCompletionAuthorityRole =
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

export type DispatchCompletionAuthorityAction =
  | "dispatch:completion_review"
  | "dispatch:attest_completion"
  | "dispatch:place_completion_hold"
  | "dispatch:release_completion_hold";

export type DispatchCompletionForbiddenAction =
  | "dispatch:mark_dispatched"
  | "dispatch:complete"
  | "dispatch:final_release"
  | "dispatch:mutate_order_status";

export interface DispatchCompletionAuthorityContext {
  actorRole: string;
  overrideReason?: string | null;
}

export interface DispatchCompletionAuthorityResult {
  allowed: boolean;
  reason: string;
}
