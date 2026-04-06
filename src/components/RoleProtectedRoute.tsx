import { Navigate, useLocation } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { Loader2 } from "lucide-react";
import { getRoleDestination, normalizeRole, isStaffRole, isPathWithinRoleDestination } from "@/lib/auth-routing";

interface Props {
  allowedRoles: (string | null)[];
  children: React.ReactNode;
}

export default function RoleProtectedRoute({ allowedRoles, children }: Props) {
  const location = useLocation();
  const { user, loading: authLoading, role, profileReady } = useAuth();

  // Still loading auth session
  if (authLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 size={24} className="animate-spin text-primary" />
      </div>
    );
  }

  // Not logged in
  if (!user) {
    return <Navigate to="/login" replace />;
  }

  const normalizedRole = normalizeRole(role);
  const destination = getRoleDestination(normalizedRole);
  const isAllowed = allowedRoles.some((ar) => {
    if (ar === null) return normalizedRole === null;
    return ar.toUpperCase() === normalizedRole;
  });
  const isWithinDestination = isPathWithinRoleDestination(location.pathname, normalizedRole);

  // Staff roles: skip profileReady wait — land instantly
  if (normalizedRole && isStaffRole(normalizedRole)) {
    if (!isAllowed && !isWithinDestination) {
      return <Navigate to={destination} replace />;
    }
    return <>{children}</>;
  }

  // Non-staff: wait for profile to resolve (one-time)
  if (!normalizedRole && !profileReady) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 size={24} className="animate-spin text-primary" />
      </div>
    );
  }

  // Pending or null role after profile loaded
  if (!normalizedRole || normalizedRole === "PENDING") {
    return <Navigate to="/approval-pending" replace />;
  }

  if (!isAllowed && !isWithinDestination) {
    return <Navigate to={destination} replace />;
  }

  return <>{children}</>;
}
