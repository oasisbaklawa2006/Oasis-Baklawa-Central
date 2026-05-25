export const FINANCE_AUTHORITY_ACTIONS = [
  "finance:review",
  "finance:verify_advance",
  "finance:place_hold",
  "finance:release_hold",
  "finance:commercial_release",
  "finance:reject_release",
  "finance:override_review",
] as const;

export type FinanceAuthorityAction = (typeof FINANCE_AUTHORITY_ACTIONS)[number];

export const FINANCE_FORBIDDEN_ACTIONS = [
  "finance:capture_payment",
  "finance:generate_invoice",
  "finance:dispatch_complete",
  "finance:deduct_stock",
] as const;

export interface FinanceAuthorityContext {
  actorRole: string;
  actorUserId: string;
  overrideReason?: string | null;
}

export interface FinanceAuthorityResult {
  allowed: boolean;
  reason: string;
}
