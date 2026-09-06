import { useEffect, useRef } from "react";
import { Navigate, useLocation } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";
import { isAuthorizedForAdminPath } from "@/lib/appverse/routeAccess";
import { getRoleDestination } from "@/lib/auth-routing";

/** Resolve the governed redirect target when an admin route is denied for the current role. */
function getUnauthorizedRedirect(role: string | null | undefined): string {
  const normalizedRole = role?.trim().toUpperCase();
  if (normalizedRole === "SALES_EXECUTIVE") return "/sales/dashboard";
  const destination = getRoleDestination(role);
  return destination === "/customer-app-redirect" ? "/admin" : destination;
}

/** Enforce admin-route RBAC after profile hydration; deny with render-time redirect. */
export default function AdminRouteGuard({ children }: { children: React.ReactNode }) {
  const { user, role, loading: authLoading, profileReady } = useAuth();
  const location = useLocation();
  const lastLoggedViolation = useRef<string | null>(null);

  const enforce = Boolean(user && location.pathname.startsWith("/admin"));
  const roleReady = !enforce || profileReady;
  const authorized = !enforce || isAuthorizedForAdminPath(location.pathname, role);

  useEffect(() => {
    if (!enforce || authLoading || !profileReady || authorized) {
      if (authorized) lastLoggedViolation.current = null;
      return;
    }

    const violationKey = `${location.pathname}|${role ?? "UNKNOWN"}`;
    if (lastLoggedViolation.current !== violationKey) {
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
    }
  }, [enforce, authorized, authLoading, profileReady, user, role, location.pathname]);

  if ((authLoading || !roleReady) && enforce) return null;
  if (!authorized && enforce) {
    return <Navigate to={getUnauthorizedRedirect(role)} replace />;
  }
  return <>{children}</>;
}
