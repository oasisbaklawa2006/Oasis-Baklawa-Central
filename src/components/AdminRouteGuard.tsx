import { useEffect, useState } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";

const RESTRICTED_PREFIXES = ["/admin/finance", "/admin/heartbeat", "/admin/notifications", "/admin/users"];

export default function AdminRouteGuard({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const [checked, setChecked] = useState(false);
  const [blocked, setBlocked] = useState(false);

  useEffect(() => {
    if (!user) { setChecked(true); return; }

    const isRestricted = RESTRICTED_PREFIXES.some((p) => location.pathname.startsWith(p));
    if (!isRestricted) { setChecked(true); setBlocked(false); return; }

    (async () => {
      const { data } = await supabase.from("users").select("role").eq("id", user.id).maybeSingle();
      if (data?.role === "sales_executive") {
        // Log security violation to audit trail
        await supabase.from("audit_logs").insert({
          action_type: "security_violation_blocked",
          actor_id: user.id,
          module_name: "AdminRouteGuard",
          entity_name: "route_access",
          entity_id: location.pathname,
          reason: `Sales Executive attempted to access restricted route: ${location.pathname}`,
          risk_level: "high",
        });
        toast.error("Security Violation — Unauthorized access attempt logged.");
        navigate("/dashboard", { replace: true });
        setBlocked(true);
      } else {
        setBlocked(false);
      }
      setChecked(true);
    })();
  }, [user, location.pathname, navigate]);

  if (!checked || blocked) return null;
  return <>{children}</>;
}
