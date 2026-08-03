import { Navigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import {
  getAllowedModulesForRole,
  hasModuleAccess,
  type AppVerseModuleKey,
} from "@/lib/appverse/roleAccess";

interface AdminModuleRouteProps {
  moduleKey: AppVerseModuleKey;
  children: React.ReactNode;
}

/** Router-level guard for explicit admin module routes. */
export default function AdminModuleRoute({ moduleKey, children }: AdminModuleRouteProps) {
  const { role } = useAuth();
  const allowedModules = getAllowedModulesForRole(role);
  if (!hasModuleAccess(allowedModules, moduleKey)) {
    return <Navigate to="/admin" replace />;
  }
  return <>{children}</>;
}
