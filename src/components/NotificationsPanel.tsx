import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, Package, CreditCard, Sparkles, Bell } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";

interface OutboxNotification {
  id: string;
  event_type: string | null;
  message_body: string;
  status: string | null;
  created_at: string | null;
  recipient_email: string | null;
}

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

const NotificationsPanel = ({ open, onClose }: { open: boolean; onClose: () => void }) => {
  const [notifications, setNotifications] = useState<OutboxNotification[]>([]);
  const [hasNew, setHasNew] = useState(false);
  const { user } = useAuth();

  useEffect(() => {
    if (!open || !user) return;

    const load = async () => {
      const { data } = await supabase
        .from("notification_outbox")
        .select("id, event_type, message_body, status, created_at, recipient_email")
        .order("created_at", { ascending: false })
        .limit(10);
      setNotifications((data as OutboxNotification[]) || []);
      setHasNew(false);
    };
    load();

    const channel = supabase
      .channel("outbox-live")
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "notification_outbox" },
        (payload) => {
          const row = payload.new as OutboxNotification;
          setNotifications((prev) => [row, ...prev].slice(0, 10));
          setHasNew(true);
        }
      )
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "notification_outbox" },
        (payload) => {
          const row = payload.new as OutboxNotification;
          setNotifications((prev) =>
            prev.map((n) => (n.id === row.id ? row : n))
          );
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [open, user]);

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
                  const { Icon, bg, color } = getIcon(n.event_type);
                  return (
                    <div key={n.id} className="flex items-start gap-3 p-4 hover:bg-muted/30 transition-colors">
                      <div className={`w-9 h-9 rounded-full ${bg} flex items-center justify-center flex-shrink-0`}>
                        <Icon size={16} className={color} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <p className="font-body font-semibold text-foreground text-sm truncate">
                            {n.event_type?.replace(/_/g, " ") || "Notification"}
                          </p>
                          <span className={`text-[9px] px-1.5 py-0.5 rounded-full font-bold uppercase ${
                            n.status === "sent" ? "bg-green-100 text-green-700" :
                            n.status === "failed" ? "bg-red-100 text-red-700" :
                            "bg-yellow-100 text-yellow-700"
                          }`}>{n.status}</span>
                        </div>
                        <p className="font-body text-xs text-muted-foreground leading-relaxed mt-0.5 line-clamp-2">{n.message_body}</p>
                        <p className="font-body text-[11px] text-muted-foreground/60 mt-1">{timeAgo(n.created_at)}</p>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
            <div className="p-3 border-t border-border">
              <button className="w-full py-2 rounded-lg font-body text-xs font-medium text-primary hover:bg-primary/5 transition-colors">
                View All Notifications
              </button>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
};

export default NotificationsPanel;
