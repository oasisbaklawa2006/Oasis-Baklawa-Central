import { useEffect, useState } from "react";
import { Navigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { Loader2 } from "lucide-react";

const PROD_ROLE_ROUTES: Record<string, string> = {
  PROD_ARABIC_SWEETS: "/tv/arabic-sweets",
  PROD_CHOCOLATE: "/tv/chocolate",
  PROD_FUSION: "/tv/fusion",
  PROD_BAKERY: "/tv/bakery",
  PROD_NUTS: "/tv/nuts",
};

function getDesignatedRoute(role: string): string {
  const upper = role.toUpperCase();
  if (PROD_ROLE_ROUTES[upper]) return PROD_ROLE_ROUTES[upper];
  if (upper === "SALES_EXECUTIVE") return "/sales/dashboard";
  if (upper === "ASSEMBLY_MANAGER") return "/operations-controller";

  const INTERNAL_SET = new Set([
    "FINANCE_HEAD", "DISPATCH_HEAD", "PRODUCTION_MANAGER",
    "PACKING_SUPERVISOR", "SUPPORT_EXECUTIVE",
    "STORE_READY_GOODS", "STORE_3RD_PARTY", "GATE_SECURITY",
  ]);
  if (INTERNAL_SET.has(upper)) return "/operations-controller";

  if (upper === "CUSTOMER_USER" || upper === "CLIENT") return "/home";
  if (upper === "BUYER") return "/home";

  return "/approval-pending";
}

interface Props {
  allowedRoles: (string | null)[];
  children: React.ReactNode;
}

export default function RoleProtectedRoute({ allowedRoles, children }: Props) {
  const { user, loading: authLoading, role, profileReady } = useAuth();
  const [status, setStatus] = useState<"loading" | "allowed" | "denied">("loading");
  const [redirectTo, setRedirectTo] = useState("/");

  useEffect(() => {
    if (authLoading || !profileReady) return;

    // Not logged in → login
    if (!user) {
      setRedirectTo("/login");
      setStatus("denied");
      return;
    }

    const normalizedRole = role?.toUpperCase() || null;

    // SAFETY VALVE: Admin/Super Admin bypass all checks
    if (normalizedRole === "ADMIN" || normalizedRole === "SUPER_ADMIN") {
      setStatus("allowed");
      return;
    }

    // No role → approval pending
    if (!normalizedRole) {
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
      // Redirect to their designated route
      setRedirectTo(getDesignatedRoute(normalizedRole));
      setStatus("denied");
    }
  }, [user, authLoading, allowedRoles, role, profileReady]);

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
