import { useEffect, useState, useRef } from "react";
import { Navigate, useLocation } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { Loader2 } from "lucide-react";
import { getRoleDestination, normalizeRole, isStaffRole, isPathWithinRoleDestination, fetchAuthRoleRecord } from "@/lib/auth-routing";
import { supabase } from "@/integrations/supabase/client";

interface Props {
  allowedRoles: (string | null)[];
  children: React.ReactNode;
}

export default function RoleProtectedRoute({ allowedRoles, children }: Props) {
  const location = useLocation();
  const { user, loading: authLoading, role, profileReady } = useAuth();
  const [allowSpinnerFallback, setAllowSpinnerFallback] = useState(false);
  const [serverVerified, setServerVerified] = useState(false);
  const verifiedForRef = useRef<string | null>(null);
  const normalizedRole = normalizeRole(role);

  useEffect(() => {
    setAllowSpinnerFallback(false);

    if (!user) return;
    if (normalizedRole && isStaffRole(normalizedRole)) return;
    if (!authLoading && profileReady) return;

    const timeoutId = window.setTimeout(() => {
      setAllowSpinnerFallback(true);
    }, 1000);

    return () => {
      window.clearTimeout(timeoutId);
    };
  }, [authLoading, normalizedRole, profileReady, user, location.pathname]);

  // Server-side role verification — runs once per user session
  useEffect(() => {
    if (!user || !normalizedRole) return;
    if (verifiedForRef.current === user.id) return;

    verifiedForRef.current = user.id;
    (async () => {
      try {
        const record = await fetchAuthRoleRecord(user.id);
        const serverRole = normalizeRole(record.role);

        if (!serverRole || serverRole !== normalizedRole) {
          console.warn("[RoleProtectedRoute] Server role mismatch — forcing logout");
          await supabase.auth.signOut();
          window.location.replace("/login");
          return;
        }
        setServerVerified(true);
      } catch {
        // Network error — allow cached role to proceed
        setServerVerified(true);
      }
    })();
  }, [user, normalizedRole]);

  // Still loading auth session
  if (authLoading && !allowSpinnerFallback) {
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
  if (!normalizedRole && !profileReady && !allowSpinnerFallback) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 size={24} className="animate-spin text-primary" />
      </div>
    );
  }

  if (!normalizedRole && allowSpinnerFallback) {
    return <Navigate to="/" replace />;
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
