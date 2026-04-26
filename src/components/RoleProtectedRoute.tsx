import { useEffect, useState } from "react";
import { Navigate, useLocation } from "react-router-dom";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { getRoleDestination, normalizeRole, isStaffRole, isPathWithinRoleDestination, fetchAuthRoleRecord } from "@/lib/auth-routing";
import { signOutAndClearSession } from "@/utils/authSession";

interface Props {
  allowedRoles: (string | null)[];
  children: React.ReactNode;
}

export default function RoleProtectedRoute({ allowedRoles, children }: Props) {
  const location = useLocation();
  const { user, loading: authLoading, role, profileReady } = useAuth();
  const [serverVerified, setServerVerified] = useState(false);
  const normalizedRole = normalizeRole(role);

  useEffect(() => {
    let cancelled = false;

    if (!user || !normalizedRole) {
      setServerVerified(false);
      return;
    }

    (async () => {
      try {
        const record = await fetchAuthRoleRecord(user.id);
        const serverRole = normalizeRole(record.role);

        if (cancelled) return;

        if (!serverRole || serverRole !== normalizedRole) {
          console.warn("[RoleProtectedRoute] Server role mismatch — forcing logout");
          await signOutAndClearSession({ reason: "role_mismatch" });
          window.location.replace("/login");
          return;
        }

        setServerVerified(true);
      } catch {
        if (!cancelled) setServerVerified(true);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [normalizedRole, user]);

  if (authLoading || (user && !profileReady)) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 size={24} className="animate-spin text-primary" />
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  const destination = getRoleDestination(normalizedRole);
  const isAllowed = allowedRoles.some((ar) => {
    if (ar === null) return normalizedRole === null;
    return ar.toUpperCase() === normalizedRole;
  });
  const isWithinDestination = isPathWithinRoleDestination(location.pathname, normalizedRole);

  const bounce = (to: string) => {
    if (location.pathname !== to) {
      toast.error("Unauthorized Access — redirecting to your dashboard.");
    }
    return <Navigate to={to} replace />;
  };

  if (normalizedRole && isStaffRole(normalizedRole)) {
    if (!serverVerified) {
      return (
        <div className="min-h-screen flex items-center justify-center bg-background">
          <Loader2 size={24} className="animate-spin text-primary" />
        </div>
      );
    }

    if (!isAllowed && !isWithinDestination) {
      return bounce(destination);
    }
    return <>{children}</>;
  }

  if (!normalizedRole || normalizedRole === "PENDING") {
    return <Navigate to="/approval-pending" replace />;
  }

  if (!serverVerified) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 size={24} className="animate-spin text-primary" />
      </div>
    );
  }

  if (!isAllowed && !isWithinDestination) {
    return bounce(destination);
  }

  return <>{children}</>;
}
