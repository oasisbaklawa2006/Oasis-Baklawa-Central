import { motion, AnimatePresence } from "framer-motion";
import { X, Package, CreditCard, Sparkles } from "lucide-react";

interface Notification {
  id: string;
  type: "order" | "payment" | "promo";
  title: string;
  message: string;
  time: string;
}

const notifications: Notification[] = [
  {
    id: "1",
    type: "order",
    title: "Order Update",
    message: "Your Order ORD-074 has entered Production.",
    time: "2 hours ago",
  },
  {
    id: "2",
    type: "payment",
    title: "Payment",
    message: "Invoice INV-089 generated. Advance payment received.",
    time: "5 hours ago",
  },
  {
    id: "3",
    type: "promo",
    title: "Promotion",
    message: "Ramadan Pre-Booking is now open.",
    time: "1 day ago",
  },
];

const iconConfig = {
  order: { Icon: Package, bg: "bg-blue-50", color: "text-blue-600" },
  payment: { Icon: CreditCard, bg: "bg-green-50", color: "text-green-600" },
  promo: { Icon: Sparkles, bg: "bg-primary/10", color: "text-primary" },
};

const NotificationsPanel = ({ open, onClose }: { open: boolean; onClose: () => void }) => (
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
            <h3 className="font-display text-base tracking-wide text-foreground">Notifications</h3>
            <button onClick={onClose} className="w-7 h-7 rounded-full bg-muted/80 flex items-center justify-center">
              <X size={14} className="text-foreground" />
            </button>
          </div>
          <div className="divide-y divide-border/50">
            {notifications.map((n) => {
              const { Icon, bg, color } = iconConfig[n.type];
              return (
                <div key={n.id} className="flex items-start gap-3 p-4 hover:bg-muted/30 transition-colors">
                  <div className={`w-9 h-9 rounded-full ${bg} flex items-center justify-center flex-shrink-0`}>
                    <Icon size={16} className={color} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-body font-semibold text-foreground text-sm">{n.title}</p>
                    <p className="font-body text-xs text-muted-foreground leading-relaxed mt-0.5">{n.message}</p>
                    <p className="font-body text-[11px] text-muted-foreground/60 mt-1">{n.time}</p>
                  </div>
                </div>
              );
            })}
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

export default NotificationsPanel;
