import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { AlertTriangle } from "lucide-react";

interface SystemAlert {
  id: string;
  message: string;
  priority: string;
}

const SystemAlertMarquee = () => {
  const [alerts, setAlerts] = useState<SystemAlert[]>([]);

  useEffect(() => {
    const fetchAlerts = async () => {
      const { data } = await supabase
        .from("system_alerts")
        .select("id, message, priority")
        .eq("is_active", true)
        .or(`expires_at.is.null,expires_at.gt.${new Date().toISOString()}`);
      if (data && data.length > 0) setAlerts(data);
    };
    fetchAlerts();
  }, []);

  if (alerts.length === 0) return null;

  const text = alerts.map((a) => a.message).join("   •   ");
  const hasCritical = alerts.some((a) => a.priority === "critical");

  return (
    <div
      className={`w-full overflow-hidden py-2 px-4 text-xs font-semibold tracking-wide ${
        hasCritical
          ? "bg-destructive/10 text-destructive"
          : "bg-primary/10 text-primary"
      }`}
    >
      <div className="flex items-center gap-2 animate-marquee whitespace-nowrap">
        <AlertTriangle size={14} className="flex-shrink-0" />
        <span>{text}</span>
        <span className="mx-8">{text}</span>
      </div>
    </div>
  );
};

export default SystemAlertMarquee;
