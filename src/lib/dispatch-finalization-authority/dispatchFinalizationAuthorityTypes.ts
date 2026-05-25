export type DispatchFinalizationAuthorityRole =
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

export type DispatchFinalizationAuthorityAction =
  | "dispatch:finalize"
  | "dispatch:publish_customer_release"
  | "dispatch:reverse_release"
  | "dispatch:confirm_stock_consumption";

export type DispatchFinalizationForbiddenAction =
  | "dispatch:auto_finalize"
  | "dispatch:silent_release"
  | "dispatch:bypass_finance"
  | "dispatch:bypass_gate"
  | "dispatch:mark_dispatched";

export interface DispatchFinalizationAuthorityContext {
  actorRole: string;
  overrideReason?: string | null;
  reversalReason?: string | null;
}

export interface DispatchFinalizationAuthorityResult {
  allowed: boolean;
  reason: string;
}
