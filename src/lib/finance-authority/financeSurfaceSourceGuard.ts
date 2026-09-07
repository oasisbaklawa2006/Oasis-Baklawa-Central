/**
 * Normalizes TypeScript source for deterministic authority guard tests.
 * Strips comments and collapses whitespace so chained Supabase calls cannot
 * evade shadow-write detection through formatting or intermediate variables.
 */
export function normalizeSourceForAuthorityGuard(source: string): string {
  return source
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/\/\/.*$/gm, "")
    .replace(/\s+/g, "");
}

/** Finance legacy surfaces must not mutate orders directly — Core RPC only. */
export function hasDirectOrdersTableMutation(source: string): boolean {
  const normalized = normalizeSourceForAuthorityGuard(source);
  const fromOrders = /\.from\(["']orders["']\)/g;
  let match: RegExpExecArray | null;
  while ((match = fromOrders.exec(normalized)) !== null) {
    const tail = normalized.slice(match.index, match.index + 400);
    if (tail.includes(".update(")) return true;
  }
  return false;
}

export const FINANCE_FORBIDDEN_ORDERS_UPDATE_FIELDS = [
  'payment_status:"awaiting_advance"',
  "payment_status:'awaiting_advance'",
  'status:"awaiting_final_payment"',
  "status:'awaiting_final_payment'",
  'sales_order_value:',
] as const;

export function hasForbiddenOrdersShadowMutation(source: string): boolean {
  const normalized = normalizeSourceForAuthorityGuard(source);
  if (!hasDirectOrdersTableMutation(source)) return false;
  return FINANCE_FORBIDDEN_ORDERS_UPDATE_FIELDS.some((field) => normalized.includes(field));
}
