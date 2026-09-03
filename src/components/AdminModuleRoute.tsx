import { Navigate, useLocation } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import {
  getAllowedModulesForRole,
  hasModuleAccess,
  type AppVerseModuleKey,
} from "@/lib/appverse/roleAccess";
import { getRoleDestination, normalizePathname } from "@/lib/auth-routing";
import {
  canAccessThreePgsMobileUrgent,
  canAccessThreePgsOperator,
  canAccessThreePgsSatellite,
} from "@/lib/threePgsAccess";

interface AdminModuleRouteProps {
  moduleKey: AppVerseModuleKey;
  children: React.ReactNode;
}

/** Router-level guard for explicit admin module routes. */
export default function AdminModuleRoute({ moduleKey, children }: AdminModuleRouteProps) {
  const { role } = useAuth();
  const location = useLocation();
  const allowedModules = getAllowedModulesForRole(role);
  const pathname = normalizePathname(location.pathname);

  // R4 3PGS operator surfaces are intentionally narrower than the generic
  // inventory module. P&A/outlet/Sales/Dispatch will receive task-specific
  // satellite projections later; they must not inherit the full procurement
  // and custody-management queue simply because they can read inventory.
  if (pathname === "/admin/3pgs-procurement-queue" && !canAccessThreePgsOperator(role)) {
    return <Navigate to={getRoleDestination(role)} replace />;
  }

  if (pathname === "/admin/3pgs-visibility" && !canAccessThreePgsSatellite(role)) {
    return <Navigate to={getRoleDestination(role)} replace />;
  }

  if (pathname === "/admin/3pgs-mobile-urgent" && !canAccessThreePgsMobileUrgent(role)) {
    return <Navigate to={getRoleDestination(role)} replace />;
  }

  if (!hasModuleAccess(allowedModules, moduleKey)) {
    return <Navigate to="/admin" replace />;
  }
  return <>{children}</>;
}
