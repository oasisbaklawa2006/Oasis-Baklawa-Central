import { ReactNode, useEffect, useState } from "react";
import { Navigate, useLocation } from "react-router-dom";
import { Loader2 } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { fetchAuthRoleRecord, getRoleDestination, normalizeRole } from "@/lib/auth-routing";
import { signOutAndClearSession } from "@/lib/auth/sessionLifecycle";

type Props = {
  allowedRoles: string[];
  children: ReactNode;
};

export default function RoleProtectedRoute({ allowedRoles, children }: Props) {
  const { user, role, loading, profileReady } = useAuth();
  const location = useLocation();
  const normalizedRole = normalizeRole(role);
  const normalizedAllowedRoles = allowedRoles.map((allowedRole) => normalizeRole(allowedRole));
  const [serverVerified, setServerVerified] = useState(false);

  useEffect(() => {
    let cancelled = false;

    if (!user) {
      setServerVerified(false);
      return;
    }

    setServerVerified(false);

    (async () => {
      try {
        const record = await fetchAuthRoleRecord(user.id);
        const serverRole = normalizeRole(record.role);

        if (cancelled) return;

        if (!normalizedRole || normalizedRole === "PENDING") {
          if (serverRole && serverRole !== "PENDING" && serverRole !== normalizedRole) {
            console.info("[RoleProtectedRoute] Client role stale after auth transition — reloading authoritative destination");
            window.location.replace(getRoleDestination(serverRole));
            return;
          }

          setServerVerified(true);
          return;
        }

        if (!serverRole || serverRole !== normalizedRole) {
          console.warn("[RoleProtectedRoute] Server role mismatch — forcing logout");
          await signOutAndClearSession({ reason: "role_mismatch" });
          if (cancelled) return;
          window.location.replace("/login");
          return;
        }

        setServerVerified(true);
      } catch (error) {
        console.error("[RoleProtectedRoute] Failed to verify server role", error);
        if (!cancelled) setServerVerified(true);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [normalizedRole, user]);

  if (loading || (user && !profileReady)) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 size={24} className="animate-spin text-primary" />
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  if (!normalizedRole || normalizedRole === "PENDING") {
    if (!serverVerified) {
      return (
        <div className="min-h-screen flex items-center justify-center bg-background">
          <Loader2 size={24} className="animate-spin text-primary" />
        </div>
      );
    }
    return <Navigate to="/customer-app-redirect" replace />;
  }

  if (!serverVerified) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 size={24} className="animate-spin text-primary" />
      </div>
    );
  }

  if (!normalizedAllowedRoles.includes(normalizedRole)) {
    return <Navigate to={getRoleDestination(normalizedRole)} replace />;
  }

  return <>{children}</>;
}
