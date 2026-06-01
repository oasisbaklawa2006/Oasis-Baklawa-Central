export const STOCK_AUTHORITY_ACTIONS = [
  "stock:finalize_consumption",
  "stock:reverse_consumption",
  "stock:record_variance",
  "stock:quarantine",
  "stock:release_quarantine",
] as const;

export type StockAuthorityAction = (typeof STOCK_AUTHORITY_ACTIONS)[number];

export const STOCK_FORBIDDEN_ACTIONS = [
  "stock:silent_deduct",
  "stock:auto_adjust",
  "stock:delete_ledger",
] as const;

export type StockForbiddenAction = (typeof STOCK_FORBIDDEN_ACTIONS)[number];

export const STOCK_AUTHORITY_ROLES = [
  "SUPER_ADMIN",
  "ADMIN",
  "INVENTORY_MANAGER",
  "DISPATCH_HEAD",
  "DISPATCH_MANAGER",
  "DISPATCH_INCHARGE",
  "OPERATIONS_MANAGER",
  "FINANCE_HEAD",
  "FINANCE_EXEC",
  "OPS",
  "UNKNOWN",
] as const;

export type StockAuthorityRole = (typeof STOCK_AUTHORITY_ROLES)[number];

export interface StockAuthorityContext {
  actorRole: string;
  overrideReason?: string | null;
  reversalReason?: string | null;
  varianceReason?: string | null;
}

export interface StockAuthorityResult {
  allowed: boolean;
  reason: string;
}
