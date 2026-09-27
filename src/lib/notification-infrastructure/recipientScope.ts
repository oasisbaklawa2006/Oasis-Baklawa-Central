import type { NotificationRecipientScope, RecipientScopeResolution } from "./contract";

/**
 * Fail closed when recipient identity cannot be resolved for inbox queries.
 * Central never fabricates a scope from partial hints.
 */
export function resolveInboxRecipientScope(params: {
  userId?: string | null;
  companyId?: string | null;
}): RecipientScopeResolution {
  const userId = params.userId?.trim();
  if (!userId) {
    return { ok: false, reason: "unresolved_user_id" };
  }

  const companyId = params.companyId?.trim() || null;
  return { ok: true, scope: { userId, companyId } };
}

/**
 * Build the OR filter for inbox rows: user-targeted OR company-targeted (broadcast).
 * Pure helper — callers apply to Supabase query builders.
 */
export function inboxScopeMatchesRow(
  scope: NotificationRecipientScope,
  row: { user_id?: string | null; company_id?: string | null },
): boolean {
  if (row.user_id && row.user_id === scope.userId) return true;
  if (
    !row.user_id &&
    scope.companyId &&
    row.company_id &&
    row.company_id === scope.companyId
  ) {
    return true;
  }
  return false;
}

export function assertRecipientIsolation(
  scope: NotificationRecipientScope,
  rows: Array<{ user_id?: string | null; company_id?: string | null; id: string }>,
): void {
  for (const row of rows) {
    if (!inboxScopeMatchesRow(scope, row)) {
      throw new Error(`notification_recipient_isolation_violation:${row.id}`);
    }
  }
}
