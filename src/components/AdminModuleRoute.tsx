import { Navigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { hasAdminModuleAccess } from "@/lib/auth/adminModuleAccess";

interface AdminModuleRouteProps {
  moduleKey: string;
  children: React.ReactNode;
}

/**
 * Router-level guard for admin modules (e.g. cmd_war_room).
 * Complements ProtectedRoute + RoleProtectedRoute — blocks direct URL access without module permission.
 */
export default function AdminModuleRoute({ moduleKey, children }: AdminModuleRouteProps) {
  const { role } = useAuth();
  if (!hasAdminModuleAccess(role, moduleKey)) {
    return <Navigate to="/admin" replace />;
  }
  return <>{children}</>;
}
