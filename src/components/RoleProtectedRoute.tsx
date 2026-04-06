import { Navigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { Loader2 } from "lucide-react";
import { getRoleDestination, normalizeRole } from "@/lib/auth-routing";

interface Props {
  allowedRoles: (string | null)[];
  children: React.ReactNode;
}

export default function RoleProtectedRoute({ allowedRoles, children }: Props) {
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

  // Wait for profile to resolve (one-time, no flicker)
  const normalizedRole = normalizeRole(role);
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

  // Check if user's role is in the allowed list
  const isAllowed = allowedRoles.some((ar) => {
    if (ar === null) return normalizedRole === null;
    return ar.toUpperCase() === normalizedRole;
  });

  if (!isAllowed) {
    return <Navigate to={getRoleDestination(normalizedRole)} replace />;
  }

  return <>{children}</>;
}
