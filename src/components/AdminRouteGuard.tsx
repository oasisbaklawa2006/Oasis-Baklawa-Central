import { useEffect, useState } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";

const RESTRICTED_PREFIXES = ["/admin/finance", "/admin/heartbeat", "/admin/notifications"];

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
        toast.error("Unauthorized Access — Sales Executives cannot access this module.");
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
