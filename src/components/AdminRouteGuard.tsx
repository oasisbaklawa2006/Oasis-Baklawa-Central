import { useEffect, useRef } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";
import { isAuthorizedForAdminPath } from "@/lib/appverse/routeAccess";
import { getRoleDestination } from "@/lib/auth-routing";

function getUnauthorizedRedirect(role: string | null | undefined): string {
  const normalizedRole = role?.trim().toUpperCase();
  if (normalizedRole === "SALES_EXECUTIVE") return "/sales/dashboard";
  const destination = getRoleDestination(role);
  return destination === "/customer-app-redirect" ? "/admin" : destination;
}

export default function AdminRouteGuard({ children }: { children: React.ReactNode }) {
  const { user, role, loading: authLoading } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const lastLoggedViolation = useRef<string | null>(null);

  const enforce = Boolean(user && location.pathname.startsWith("/admin"));
  const authorized = !enforce || isAuthorizedForAdminPath(location.pathname, role);

  useEffect(() => {
    if (!enforce || authorized || authLoading) return;

    const violationKey = `${location.pathname}|${role ?? "UNKNOWN"}`;
    if (lastLoggedViolation.current === violationKey) return;
    lastLoggedViolation.current = violationKey;

    void supabase.from("audit_logs").insert({
      action_type: "security_violation_blocked",
      actor_id: user!.id,
      module_name: "AdminRouteGuard",
      entity_name: "route_access",
      entity_id: location.pathname,
      reason: `Role ${role ?? "UNKNOWN"} attempted to access restricted route: ${location.pathname}`,
      risk_level: "high",
    });
    toast.error("Security Violation — Unauthorized admin access blocked.");
    navigate(getUnauthorizedRedirect(role), { replace: true });
  }, [enforce, authorized, authLoading, user, role, location.pathname, navigate]);

  if (authLoading && enforce) return null;
  if (!authorized) return null;
  return <>{children}</>;
}
