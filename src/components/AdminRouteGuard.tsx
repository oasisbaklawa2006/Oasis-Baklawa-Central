import { useEffect, useRef } from "react";
import { Navigate, useLocation } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";
import {
  getUnauthorizedAdminRedirect,
  isAuthorizedForAdminPath,
} from "@/lib/appverse/routeAccess";

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

  if ((authLoading || !roleReady) && enforce) {
    // Cached/stale role may already prove the path is forbidden before profileReady
    // settles; redirect immediately so direct-route probes do not remain on finance.
    if (role && !authorized) {
      return <Navigate to={getUnauthorizedAdminRedirect(role)} replace />;
    }
    return null;
  }
  if (!authorized && enforce) {
    return <Navigate to={getUnauthorizedAdminRedirect(role)} replace />;
  }
  return <>{children}</>;
}
