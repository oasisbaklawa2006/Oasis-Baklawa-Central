import { Navigate, useLocation } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import {
  getAllowedModulesForRole,
  hasModuleAccess,
  type AppVerseModuleKey,
} from "@/lib/appverse/roleAccess";
import { normalizePathname } from "@/lib/auth-routing";
import { getUnauthorizedAdminRedirect } from "@/lib/appverse/routeAccess";
import {
  canAccessThreePgsMobileUrgent,
  canAccessThreePgsOperator,
  canAccessThreePgsSatelliteAdminShell,
  canAccessThreePgsTvAdminShell,
} from "@/lib/threePgsAccess";
import { canAccessCentralOrderPool } from "@/lib/centralOrderPool/centralOrderPoolAccess";

interface AdminModuleRouteProps {
  moduleKey: AppVerseModuleKey;
  children: React.ReactNode;
}

/** Router-level guard for explicit admin module routes. */
export default function AdminModuleRoute({ moduleKey, children }: AdminModuleRouteProps) {
  const { role, loading: authLoading, profileReady } = useAuth();
  const location = useLocation();
  const allowedModules = getAllowedModulesForRole(role);
  const pathname = normalizePathname(location.pathname);
  const denyRedirect = <Navigate to={getUnauthorizedAdminRedirect(role)} replace />;

  if (authLoading || !profileReady) {
    if (role && !hasModuleAccess(allowedModules, moduleKey)) {
      return denyRedirect;
    }
    return null;
  }

  // R4 3PGS operator surfaces are intentionally narrower than the generic
  // inventory module. P&A/outlet/Sales/Dispatch will receive task-specific
  // satellite projections later; they must not inherit the full procurement
  // and custody-management queue simply because they can read inventory.
  if (pathname === "/admin/3pgs-procurement-queue" && !canAccessThreePgsOperator(role)) {
    return denyRedirect;
  }

  if (pathname === "/admin/3pgs-visibility" && !canAccessThreePgsSatelliteAdminShell(role)) {
    return denyRedirect;
  }

  if (pathname === "/admin/3pgs-visibility") {
    return <>{children}</>;
  }

  if (pathname === "/admin/3pgs-mobile-urgent" && !canAccessThreePgsMobileUrgent(role)) {
    return denyRedirect;
  }

  if (pathname === "/admin/3pgs-tv" && !canAccessThreePgsTvAdminShell(role)) {
    return denyRedirect;
  }

  if (pathname === "/admin/3pgs-tv") {
    return <>{children}</>;
  }

  if (pathname === "/admin/central-pool" && !canAccessCentralOrderPool(role)) {
    return denyRedirect;
  }

  if (pathname === "/admin/central-pool") {
    return <>{children}</>;
  }

  if (!hasModuleAccess(allowedModules, moduleKey)) {
    return denyRedirect;
  }
  return <>{children}</>;
}
