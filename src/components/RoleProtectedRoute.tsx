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

        // AUTH-01 physical UAT exposed a narrow post-claim race: Supabase can
        // finish the Buyer membership claim before AuthProvider has refreshed
        // its pre-claim PENDING/null role. Do not bounce that authenticated user
        // to the access-request flow. Reconcile once against the authoritative
        // server role and reload the governed destination so AuthProvider
        // rehydrates role + company from the already-persisted session/cache.
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
        <div className="w-8 h-8 border-2 border-t-transparent rounded-full animate-spin" style={{ borderColor: "#C5A059", borderTopColor: "transparent" }} />
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
    if (!serverVerified) {
      return (
        <div className="min-h-screen flex items-center justify-center bg-background">
          <Loader2 size={24} className="animate-spin text-primary" />
        </div>
      );
    }

    // Never send an already-authenticated unresolved/pending identity back to
    // B2B application intake. That creates the physical-UAT deadlock where an
    // approved buyer is invited to reapply. Keep the user in a non-mutating
    // recovery state and let them retry the authoritative role claim safely.
    return (
      <main className="appverse-shell flex min-h-screen items-center justify-center bg-background px-6 py-10">
        <section className="w-full max-w-lg rounded-3xl border bg-card p-8 text-center shadow-sm" aria-labelledby="buyer-access-verification-heading">
          <Loader2 size={28} className="mx-auto text-primary" aria-hidden />
          <h1 id="buyer-access-verification-heading" className="mt-4 text-2xl font-semibold">Buyer access is being verified</h1>
          <p className="mt-3 text-sm text-muted-foreground">
            Your authenticated account does not need another B2B application. If your access was approved recently, retry the access check. If approval is still pending, no further form submission is required.
          </p>
          <div className="mt-6 grid gap-3 sm:grid-cols-2">
            <button
              type="button"
              onClick={() => window.location.replace("/buyer")}
              className="min-h-11 rounded-xl bg-primary px-4 py-3 text-sm font-semibold text-primary-foreground"
            >
              Retry Buyer access
            </button>
            <button
              type="button"
              onClick={() => window.location.replace("/login")}
              className="min-h-11 rounded-xl border px-4 py-3 text-sm font-semibold"
            >
              Return to login
            </button>
          </div>
        </section>
      </main>
    );
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
