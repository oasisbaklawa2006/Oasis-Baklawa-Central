import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, Package, CreditCard, Sparkles, Bell } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { removeDuplicateRealtimeChannel } from "@/utils/realtime";
import type { InAppNotificationRecord } from "@/lib/notification-infrastructure/contract";
import type { NotificationsRow } from "@/lib/notification-infrastructure/deliveryState";
import {
  fetchInboxNotifications,
  markInboxNotificationsRead,
  resolveScopeFromAuth,
} from "@/lib/notification-infrastructure/inboxClient";
import { inboxScopeMatchesRow } from "@/lib/notification-infrastructure/recipientScope";

const getIcon = (eventType: string | null) => {
  if (!eventType) return { Icon: Bell, bg: "bg-muted", color: "text-muted-foreground" };
  if (eventType.includes("order") || eventType.includes("dispatch"))
    return { Icon: Package, bg: "bg-blue-50", color: "text-blue-600" };
  if (eventType.includes("payment") || eventType.includes("wallet") || eventType.includes("credit"))
    return { Icon: CreditCard, bg: "bg-green-50", color: "text-green-600" };
  return { Icon: Sparkles, bg: "bg-primary/10", color: "text-primary" };
};

const timeAgo = (dateStr: string | null) => {
  if (!dateStr) return "";
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "Just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
};

const toInAppRecord = (row: NotificationsRow): InAppNotificationRecord => ({
  id: row.id,
  type: row.type,
  message: row.message,
  createdAt: row.created_at,
  readState: row.is_read ? "read" : "unread",
  userId: row.user_id,
  companyId: row.company_id,
});

const NotificationsPanel = ({ open, onClose }: { open: boolean; onClose: () => void }) => {
  const [notifications, setNotifications] = useState<InAppNotificationRecord[]>([]);
  const [hasNew, setHasNew] = useState(false);
  const { user, companyId } = useAuth();

  useEffect(() => {
    if (!open || !user?.id) return;

    let cancelled = false;

    const scopeResult = resolveScopeFromAuth({ userId: user.id, companyId });
    if (!scopeResult.ok) {
      setNotifications([]);
      setHasNew(false);
      return;
    }

    const scope = scopeResult.scope;
    const channelName = `inbox-live-${user.id}`;

    const load = async () => {
      const rows = await fetchInboxNotifications(scope, 10);
      if (cancelled) return;

      setNotifications(rows);
      setHasNew(false);

      const unreadIds = rows.filter((row) => row.readState === "unread").map((row) => row.id);
      if (unreadIds.length > 0) {
        await markInboxNotificationsRead(scope, unreadIds);
      }
    };
    void load();

    removeDuplicateRealtimeChannel(channelName);

    const channel = supabase
      .channel(channelName)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "notifications" },
        (payload) => {
          if (cancelled) return;
          const row = payload.new as NotificationsRow;
          if (!inboxScopeMatchesRow(scope, row)) return;
          setNotifications((prev) => [toInAppRecord(row), ...prev].slice(0, 10));
          setHasNew(true);
        }
      )
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "notifications" },
        (payload) => {
          if (cancelled) return;
          const row = payload.new as NotificationsRow;
          if (!inboxScopeMatchesRow(scope, row)) return;
          setNotifications((prev) =>
            prev.map((n) => (n.id === row.id ? toInAppRecord(row) : n)),
          );
        }
      )
      .subscribe();

    return () => {
      cancelled = true;
      setNotifications([]);
      setHasNew(false);
      void supabase.removeChannel(channel);
    };
  }, [open, user?.id, companyId]);

  return (
    <AnimatePresence>
      {open && (
        <>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[90] bg-black/20"
            onClick={onClose}
          />
          <motion.div
            initial={{ opacity: 0, y: -10, x: 20 }}
            animate={{ opacity: 1, y: 0, x: 0 }}
            exit={{ opacity: 0, y: -10 }}
            transition={{ type: "spring", damping: 25, stiffness: 350 }}
            className="fixed top-16 right-4 z-[95] w-[calc(100%-2rem)] max-w-sm bg-card rounded-2xl shadow-card overflow-hidden"
          >
            <div className="flex items-center justify-between p-4 border-b border-border">
              <h3 className="font-display text-base tracking-wide text-foreground flex items-center gap-2">
                Notifications
                {hasNew && <span className="w-2 h-2 rounded-full bg-primary animate-pulse" />}
              </h3>
              <button onClick={onClose} className="w-7 h-7 rounded-full bg-muted/80 flex items-center justify-center">
                <X size={14} className="text-foreground" />
              </button>
            </div>
            <div className="divide-y divide-border/50 max-h-80 overflow-y-auto">
              {notifications.length === 0 ? (
                <div className="py-10 text-center text-muted-foreground text-sm">No notifications yet.</div>
              ) : (
                notifications.map((n) => {
                  const { Icon, bg, color } = getIcon(n.type);
                  return (
                    <div key={n.id} className="flex items-start gap-3 p-4 hover:bg-muted/30 transition-colors">
                      <div className={`w-9 h-9 rounded-full ${bg} flex items-center justify-center flex-shrink-0`}>
                        <Icon size={16} className={color} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <p className="font-body font-semibold text-foreground text-sm truncate">
                            {n.type?.replace(/_/g, " ") || "Notification"}
                          </p>
                          <span className={`text-[9px] px-1.5 py-0.5 rounded-full font-bold uppercase ${
                            n.readState === "read" ? "bg-slate-100 text-slate-600" : "bg-primary/10 text-primary"
                          }`}>{n.readState}</span>
                        </div>
                        <p className="font-body text-xs text-muted-foreground leading-relaxed mt-0.5 line-clamp-2">{n.message}</p>
                        <p className="font-body text-[11px] text-muted-foreground/60 mt-1">{timeAgo(n.createdAt)}</p>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
};

export default NotificationsPanel;
