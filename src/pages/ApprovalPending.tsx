import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Loader2, RefreshCcw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";
import { getRoleDestination, normalizeRole } from "@/lib/auth-routing";

function getRouteForRole(role?: string | null) {
  const normalizedRole = normalizeRole(role);
  if (!normalizedRole || normalizedRole === "PENDING") return null;
  return getRoleDestination(normalizedRole);
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
      // Hard-fetch the user's current state from the database
      const [usersResult, profilesResult] = await Promise.all([
        supabase.from("users").select("role, company_id").eq("id", user.id).maybeSingle(),
        supabase.from("profiles").select("role, company_id, status, is_approved").eq("id", user.id).maybeSingle(),
      ]);

      const userRecord = usersResult.data;
      const profileRecord = profilesResult.data;

      const resolvedRole = normalizeRole(profileRecord?.role) || normalizeRole(userRecord?.role);
      const resolvedCompanyId = profileRecord?.company_id || userRecord?.company_id;
      const isApproved = profileRecord?.is_approved === true || profileRecord?.status === "approved";

      // Also check server-side role
      const { data: serverRole } = await supabase.rpc("get_user_role", { _user_id: user.id });
      const finalRole = normalizeRole(serverRole) || resolvedRole;

      const nextRoute = getRouteForRole(finalRole);

      // Only navigate if the user actually has a valid role AND company_id (for buyer roles)
      // or is internal staff
      const { data: isStaff } = await supabase.rpc("is_internal_staff", { _user_id: user.id });

      if (isStaff) {
        await refreshProfile();
        toast.success("Access confirmed.");
        navigate(nextRoute ?? "/operations-controller", { replace: true });
        return;
      }

      if (resolvedCompanyId && (isApproved || nextRoute)) {
        await refreshProfile();
        toast.success("Access confirmed — welcome!");
        navigate(nextRoute ?? "/home", { replace: true });
        return;
      }

      // Still not approved
      toast("Still under review", {
        description: "Your account has not been approved yet. Please contact support.",
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
        <div className="flex gap-2">
          <a href="tel:+919876543210" className="flex-1">
            <Button variant="outline" className="w-full text-sm">📞 Call Us</Button>
          </a>
          <a href="https://wa.me/919876543210?text=Hi%2C%20I%20submitted%20a%20B2B%20application%20and%20wanted%20to%20check%20the%20status." target="_blank" rel="noopener noreferrer" className="flex-1">
            <Button variant="outline" className="w-full text-sm">💬 WhatsApp</Button>
          </a>
        </div>
        <Button onClick={handleCheckStatus} disabled={checkingStatus} className="w-full">
          {checkingStatus ? <Loader2 className="animate-spin" /> : <RefreshCcw />}
          {checkingStatus ? "Checking approval..." : "Check Approval Status"}
        </Button>
      </div>
    </div>
  );
}
