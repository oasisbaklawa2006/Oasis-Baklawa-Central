import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { AlertTriangle, X } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

const PanicAlertBanner = () => {
  const [alerts, setAlerts] = useState<any[]>([]);

  useEffect(() => {
    const fetchCritical = async () => {
      const { data } = await supabase
        .from("notification_outbox")
        .select("id, message_body, event_type, created_at")
        .eq("priority", "critical")
        .in("status", ["pending", "failed"])
        .order("created_at", { ascending: false })
        .limit(5);
      setAlerts(data || []);
    };

    fetchCritical();
    const interval = setInterval(fetchCritical, 15000);
    return () => clearInterval(interval);
  }, []);

  if (alerts.length === 0) return null;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ height: 0, opacity: 0 }}
        animate={{ height: "auto", opacity: 1 }}
        exit={{ height: 0, opacity: 0 }}
        className="bg-destructive/15 border-b-2 border-destructive/40 overflow-hidden"
      >
        {alerts.map((a) => (
          <div key={a.id} className="flex items-center gap-3 px-5 py-2.5">
            <AlertTriangle size={16} className="text-destructive flex-shrink-0 animate-pulse" />
            <p className="text-xs font-semibold text-destructive flex-1">
              🚨 CRITICAL: {a.event_type || "Panic Alert"} — {a.message_body?.slice(0, 120)}
            </p>
            <span className="text-[10px] text-destructive/70 font-mono flex-shrink-0">UNSENT</span>
          </div>
        ))}
      </motion.div>
    </AnimatePresence>
  );
};

export default PanicAlertBanner;
