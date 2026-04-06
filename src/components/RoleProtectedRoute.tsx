import { useEffect, useState } from "react";
import { Navigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { Loader2 } from "lucide-react";
import { getRoleDestination, normalizeRole } from "@/lib/auth-routing";

interface Props {
  allowedRoles: (string | null)[];
  children: React.ReactNode;
}

export default function RoleProtectedRoute({ allowedRoles, children }: Props) {
  const { user, loading: authLoading, role } = useAuth();
  const [status, setStatus] = useState<"loading" | "allowed" | "denied">("loading");
  const [redirectTo, setRedirectTo] = useState("/");

  useEffect(() => {
    // Only block on auth loading — do NOT block on profileReady
    if (authLoading) return;

    // Not logged in → login
    if (!user) {
      setRedirectTo("/login");
      setStatus("denied");
      return;
    }

    const normalizedRole = normalizeRole(role);

    // Role not yet fetched from DB — wait silently (single tick)
    if (normalizedRole === null && role === null) {
      // role is still being fetched; stay in loading but do NOT flicker
      return;
    }

    // Pending or truly null role → approval pending
    if (!normalizedRole || normalizedRole === "PENDING") {
      setRedirectTo("/approval-pending");
      setStatus("denied");
      return;
    }

    // Check if user's role is in the allowed list
    const isAllowed = allowedRoles.some((ar) => {
      if (ar === null) return normalizedRole === null;
      return ar.toUpperCase() === normalizedRole;
    });

    if (isAllowed) {
      setStatus("allowed");
    } else {
      setRedirectTo(getRoleDestination(normalizedRole));
      setStatus("denied");
    }
  }, [user, authLoading, allowedRoles, role]);

  if (status === "loading") {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 size={24} className="animate-spin text-primary" />
      </div>
    );
  }

  if (status === "denied") return <Navigate to={redirectTo} replace />;
  return <>{children}</>;
}
