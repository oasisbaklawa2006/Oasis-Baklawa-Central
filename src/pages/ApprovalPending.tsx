import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Loader2, RefreshCcw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";

import { fetchAuthRoleRecord, getRoleDestination, isInternalStaffUser, normalizeRole } from "@/lib/auth-routing";
...
      const [authRecord, isInternalStaff] = await Promise.all([
        fetchAuthRoleRecord(activeUser.id),
        isInternalStaffUser(activeUser.id),
      ]);

      await refreshProfile();

      const nextRoute = getRouteForRole(authRecord.role);

      if (isInternalStaff || nextRoute) {
        toast.success("Access confirmed.");
        navigate(nextRoute ?? "/operations-controller", { replace: true });
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