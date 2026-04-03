import { useEffect, useState } from "react";
import { Navigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
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
  const ADMIN_SET = new Set([
    "SUPER_ADMIN", "ADMIN", "FINANCE_HEAD", "DISPATCH_HEAD", "PRODUCTION_MANAGER",
    "ASSEMBLY_MANAGER", "PACKING_SUPERVISOR", "SUPPORT_EXECUTIVE",
    "STORE_READY_GOODS", "STORE_3RD_PARTY", "GATE_SECURITY",
  ]);
  if (ADMIN_SET.has(upper)) return "/admin";
  return "/";
}

interface Props {
  allowedRoles: (string | null)[];
  children: React.ReactNode;
}

export default function RoleProtectedRoute({ allowedRoles, children }: Props) {
  const { user, loading: authLoading } = useAuth();
  const [status, setStatus] = useState<"loading" | "allowed" | "denied">("loading");
  const [redirectTo, setRedirectTo] = useState("/");

  useEffect(() => {
    if (authLoading) return;
    if (!user) {
      setRedirectTo("/login");
      setStatus("denied");
      return;
    }

    (async () => {
      const { data } = await supabase
        .from("users")
        .select("role")
        .eq("id", user.id)
        .maybeSingle();

      const rawRole = data?.role ?? null;
      const upperRole = rawRole?.toUpperCase() ?? null;

      // Check if null is explicitly allowed (for buyers with no role set)
      const allowsNull = allowedRoles.includes(null);
      const normalizedAllowed = allowedRoles
        .filter((r): r is string => r !== null)
        .map((r) => r.toUpperCase());

      if ((upperRole === null && allowsNull) || (upperRole !== null && normalizedAllowed.includes(upperRole))) {
        setStatus("allowed");
      } else {
        setRedirectTo(getDesignatedRoute(upperRole || "BUYER"));
        setStatus("denied");
      }
    })();
  }, [user, authLoading, allowedRoles]);

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
