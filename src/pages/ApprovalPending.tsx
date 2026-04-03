import { Clock, LogOut } from "lucide-react";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { useNavigate } from "react-router-dom";

const ApprovalPending = () => {
  const navigate = useNavigate();

  const handleLogout = async () => {
    await supabase.auth.signOut();
    navigate("/login");
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-background px-4">
      <div className="max-w-md w-full text-center space-y-6">
        <div className="mx-auto w-20 h-20 rounded-full bg-amber-100 flex items-center justify-center">
          <Clock size={40} className="text-amber-600" />
        </div>
        <h1 className="text-2xl font-bold text-foreground">Application Under Review</h1>
        <p className="text-muted-foreground">
          Your B2B account application is currently being reviewed by our team.
          You'll receive an email notification once your account has been approved.
        </p>
        <p className="text-sm text-muted-foreground">
          If you have questions, please contact{" "}
          <a href="mailto:support@oasisbaklawa.com" className="text-primary underline">
            support@oasisbaklawa.com
          </a>
        </p>
        <Button variant="outline" onClick={handleLogout} className="gap-2">
          <LogOut size={16} />
          Sign Out
        </Button>
      </div>
    </div>
  );
};

export default ApprovalPending;
