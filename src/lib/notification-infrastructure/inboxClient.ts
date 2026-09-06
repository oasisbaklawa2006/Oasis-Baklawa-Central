import { supabase } from "@/integrations/supabase/client";
import type { InAppNotificationRecord, NotificationRecipientScope } from "./contract";
import { projectInAppNotification } from "./deliveryState";
import { assertRecipientIsolation, resolveInboxRecipientScope } from "./recipientScope";

const INBOX_SELECT =
  "id, type, message, created_at, is_read, user_id, company_id";

type NotificationsRow = {
  id: string;
  type: string | null;
  message: string | null;
  created_at: string | null;
  is_read: boolean | null;
  user_id: string | null;
  company_id: string | null;
};

export async function fetchInboxUnreadCount(scope: NotificationRecipientScope): Promise<number> {
  let query = supabase
    .from("notifications")
    .select("*", { count: "exact", head: true })
    .eq("is_read", false);

  if (scope.companyId) {
    query = query.or(
      `user_id.eq.${scope.userId},and(user_id.is.null,company_id.eq.${scope.companyId})`,
    );
  } else {
    query = query.eq("user_id", scope.userId);
  }

  const { count, error } = await query;
  if (error) {
    console.error("[notification-inbox] unread count failed:", error.message);
    return 0;
  }
  return count ?? 0;
}

export async function fetchInboxNotifications(
  scope: NotificationRecipientScope,
  limit = 10,
): Promise<InAppNotificationRecord[]> {
  let query = supabase.from("notifications").select(INBOX_SELECT);

  if (scope.companyId) {
    query = query.or(
      `user_id.eq.${scope.userId},and(user_id.is.null,company_id.eq.${scope.companyId})`,
    );
  } else {
    query = query.eq("user_id", scope.userId);
  }

  const { data, error } = await query.order("created_at", { ascending: false }).limit(limit);
  if (error) {
    console.error("[notification-inbox] fetch failed:", error.message);
    return [];
  }

  const rows = (data ?? []) as NotificationsRow[];
  assertRecipientIsolation(scope, rows);
  return rows.map(projectInAppNotification);
}

export async function markInboxNotificationsRead(
  scope: NotificationRecipientScope,
  notificationIds: string[],
): Promise<{ updated: number }> {
  if (notificationIds.length === 0) return { updated: 0 };

  let query = supabase
    .from("notifications")
    .update({ is_read: true })
    .in("id", notificationIds)
    .eq("is_read", false);

  if (scope.companyId) {
    query = query.or(
      `user_id.eq.${scope.userId},and(user_id.is.null,company_id.eq.${scope.companyId})`,
    );
  } else {
    query = query.eq("user_id", scope.userId);
  }

  const { data, error } = await query.select("id");
  if (error) {
    console.error("[notification-inbox] mark read failed:", error.message);
    return { updated: 0 };
  }
  return { updated: data?.length ?? 0 };
}

export async function markAllInboxUnreadRead(
  scope: NotificationRecipientScope,
): Promise<{ updated: number }> {
  let query = supabase.from("notifications").update({ is_read: true }).eq("is_read", false);

  if (scope.companyId) {
    query = query.or(
      `user_id.eq.${scope.userId},and(user_id.is.null,company_id.eq.${scope.companyId})`,
    );
  } else {
    query = query.eq("user_id", scope.userId);
  }

  const { data, error } = await query.select("id");
  if (error) {
    console.error("[notification-inbox] mark all read failed:", error.message);
    return { updated: 0 };
  }
  return { updated: data?.length ?? 0 };
}

export function resolveScopeFromAuth(params: {
  userId?: string | null;
  companyId?: string | null;
}) {
  return resolveInboxRecipientScope(params);
}
