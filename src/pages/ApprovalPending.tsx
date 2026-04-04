import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Loader2, RefreshCcw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";

const PROD_ROLE_ROUTES: Record<string, string> = {
  PROD_ARABIC_SWEETS: "/tv/arabic-sweets",
  PROD_CHOCOLATE: "/tv/chocolate",
  PROD_FUSION: "/tv/fusion",
  PROD_BAKERY: "/tv/bakery",
  PROD_NUTS: "/tv/nuts",
};

function getRouteForRole(role?: string | null) {
  const normalizedRole = role?.trim().toUpperCase() ?? null;

  if (!normalizedRole || normalizedRole === "PENDING") return null;
  if (normalizedRole === "ADMIN" || normalizedRole === "SUPER_ADMIN") return "/admin";
  if (normalizedRole === "CLIENT" || normalizedRole === "BUYER" || normalizedRole === "CUSTOMER_USER") return "/home";
  if (normalizedRole === "SALES_EXECUTIVE") return "/sales/dashboard";

  return PROD_ROLE_ROUTES[normalizedRole] ?? null;
}

export default function ApprovalPending() {
  const navigate = useNavigate();
  const { user, role, profileReady, refreshProfile } = useAuth();
  const [checkingStatus, setCheckingStatus] = useState(false);

  const destination = useMemo(() => getRouteForRole(role), [role]);

  useEffect(() => {
    if (!profileReady || !destination) return;
    navigate(destination, { replace: true });
  }, [destination, navigate, profileReady]);

  const handleCheckStatus = async () => {
    if (!user) {
      toast.error("Please log in again.");
      navigate("/login", { replace: true });
      return;
    }

    setCheckingStatus(true);

    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const activeSession = sessionData.session;

      try {
        localStorage.clear();
      } catch {}

      try {
        sessionStorage.clear();
      } catch {}

      if (activeSession) {
        await supabase.auth.setSession({
          access_token: activeSession.access_token,
          refresh_token: activeSession.refresh_token,
        });
      }

      const { data: authData, error: authError } = await supabase.auth.getUser();
      const activeUser = authData.user ?? user;

      if (authError || !activeUser) {
        throw authError ?? new Error("No active user session found.");
      }

      const { data, error } = await supabase
        .from("users")
        .select("role, company_id")
        .eq("id", activeUser.id)
        .maybeSingle();

      if (error) throw error;

      await refreshProfile();

      const nextRoute = getRouteForRole(data?.role);

      if (nextRoute) {
        toast.success("Approval confirmed.");
        navigate(nextRoute, { replace: true });
        return;
      }

      toast("Still under review", {
        description: "Your account has not been approved yet.",
      });
    } catch (error) {
      console.error("[ApprovalPending] Hard status check failed:", error);
      toast.error("Could not verify approval status.");
    } finally {
      setCheckingStatus(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-6">
      <div className="w-full max-w-md rounded-2xl border border-border bg-card p-6 text-center shadow-sm space-y-4">
        <h1 className="text-2xl font-bold text-foreground">Application Under Review</h1>
        <p className="text-muted-foreground">
          Your B2B account application is currently being reviewed. You will be notified once approved.
        </p>
        <p className="text-sm text-muted-foreground">Contact: support@oasisbaklawa.com</p>
        <Button
          onClick={handleCheckStatus}
          disabled={checkingStatus}
          className="w-full"
        >
          {checkingStatus ? <Loader2 className="animate-spin" /> : <RefreshCcw />}
          {checkingStatus ? "Checking approval..." : "Check Approval Status"}
        </Button>
      </div>
    </div>
  );
}