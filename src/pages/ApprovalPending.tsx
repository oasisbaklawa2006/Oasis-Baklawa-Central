import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Loader2, RefreshCcw } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { getRoleDestination, isStorefrontRole, normalizeRole } from "@/lib/auth-routing";

function getRouteForRole(role?: string | null) {
  const normalizedRole = normalizeRole(role);
  if (!normalizedRole || normalizedRole === "PENDING") return null;
  return getRoleDestination(normalizedRole);
}

export default function ApprovalPending() {
  const navigate = useNavigate();
  const { user, role, companyId, profileReady, refreshProfile } = useAuth();
  const [checkingStatus, setCheckingStatus] = useState(false);

  const destination = useMemo(() => getRouteForRole(role), [role]);

  useEffect(() => {
    if (!profileReady || !destination) return;
    if (isStorefrontRole(role) && !companyId) return;
    navigate(destination, { replace: true });
  }, [companyId, destination, navigate, profileReady, role]);

  const handleCheckStatus = async () => {
    if (!user) {
      toast.error("Please log in again.");
      navigate("/login", { replace: true });
      return;
    }

    setCheckingStatus(true);

    try {
      const [profilesResult, usersResult, staffResult] = await Promise.all([
        supabase.from("profiles").select("status, role, company_id, is_approved").eq("id", user.id).maybeSingle(),
        supabase.from("users").select("role, company_id").eq("id", user.id).maybeSingle(),
        supabase.rpc("is_internal_staff", { _user_id: user.id }),
      ]);

      const profileRecord = profilesResult.data;
      const userRecord = usersResult.data;
      const isStaff = Boolean(staffResult.data);
      const profileStatus = profileRecord?.status?.trim().toLowerCase() ?? null;
      const resolvedRole = normalizeRole(profileRecord?.role) || normalizeRole(userRecord?.role);
      const resolvedCompanyId = profileRecord?.company_id || userRecord?.company_id || companyId;

      if (isStaff) {
        await refreshProfile();
        toast.success("Access confirmed.");
        navigate(getRouteForRole(resolvedRole) ?? "/operations-controller", { replace: true });
        return;
      }

      if (profileStatus === "approved" && resolvedCompanyId) {
        await refreshProfile();
        toast.success("Access confirmed — welcome!");
        navigate("/home", { replace: true });
        return;
      }

      if (profileStatus === "approved") {
        toast.error("Approval is complete, but your account setup is still syncing.");
        return;
      }

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
          <a href="tel:+919999792959" onClick={(e) => {
            if (!/Mobi|Android/i.test(navigator.userAgent)) {
              e.preventDefault();
              toast.info("📞 Call us at: +91 99997 92959");
            }
          }} className="flex-1">
            <Button variant="outline" className="w-full text-sm">📞 Call Us</Button>
          </a>
          <a href="https://wa.me/919891162212?text=Hi%2C%20I%20submitted%20a%20B2B%20application%20and%20wanted%20to%20check%20the%20status." target="_blank" rel="noopener noreferrer" className="flex-1">
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
