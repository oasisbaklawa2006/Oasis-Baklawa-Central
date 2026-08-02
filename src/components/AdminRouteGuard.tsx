import { useEffect, useState } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";
import { getAllowedModulesForRole, hasModuleAccess } from "@/lib/appverse/roleAccess";
import { getRequiredModuleForAdminPath } from "@/lib/appverse/routeAccess";

export default function AdminRouteGuard({ children }: { children: React.ReactNode }) {
  const { user, role } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const [checked, setChecked] = useState(false);
  const [blocked, setBlocked] = useState(false);

  useEffect(() => {
    if (!user || !location.pathname.startsWith("/admin")) {
      setChecked(true);
      setBlocked(false);
      return;
    }

    const requiredModule = getRequiredModuleForAdminPath(location.pathname);
    const allowedModules = getAllowedModulesForRole(role);
    const authorized = requiredModule !== null && hasModuleAccess(allowedModules, requiredModule);

    if (authorized) {
      setChecked(true);
      setBlocked(false);
      return;
    }

    setChecked(false);
    setBlocked(true);

    void supabase.from("audit_logs").insert({
      action_type: "security_violation_blocked",
      actor_id: user.id,
      module_name: "AdminRouteGuard",
      entity_name: "route_access",
      entity_id: location.pathname,
      reason: `Role ${role ?? "UNKNOWN"} attempted to access restricted route: ${location.pathname}`,
      risk_level: "high",
    });
    toast.error("Security Violation — Unauthorized admin access blocked.");

    const normalizedRole = role?.trim().toUpperCase();
    navigate(normalizedRole === "SALES_EXECUTIVE" ? "/sales/dashboard" : "/admin", { replace: true });
    setChecked(true);
  }, [user, role, location.pathname, navigate]);

  if (!checked || blocked) return null;
  return <>{children}</>;
}
