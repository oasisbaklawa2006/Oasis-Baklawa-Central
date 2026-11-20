import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Loader2, Lock, CheckCircle2 } from "lucide-react";
import { useNavigate } from "react-router-dom";

const ResetPassword = () => {
  const navigate = useNavigate();
  // The query flag controls presentation only. Authorization is verified
  // through Supabase Auth; an invite=1 URL is never accepted as proof.
  const isStaffInvite = new URLSearchParams(window.location.search).get("invite") === "1";
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);
  // Once the password is saved, never repeat updateUser merely because
  // sign-out failed. Only the local-session cleanup should be retried.
  const [passwordSaved, setPasswordSaved] = useState(false);

  const finishSignOut = async () => {
    setLoading(true);
    try {
      const { error: signOutError } = await supabase.auth.signOut({ scope: "local" });
      if (signOutError) {
        toast.error("Password saved, but sign-out failed. Retry signing out; do not reset the password again.");
        return;
      }
      setDone(true);
      toast.success(isStaffInvite ? "Staff account password set." : "Staff password updated.");
      setTimeout(() => navigate("/staff/login", { replace: true }), 1500);
    } catch {
      toast.error("Password saved, but sign-out could not finish. Retry signing out.");
    } finally {
      setLoading(false);
    }
  };

  const handleReset = async () => {
    if (passwordSaved || loading) return;
    if (password.length < 6) {
      toast.error("Password must be at least 6 characters.");
      return;
    }
    if (password !== confirm) {
      toast.error("Passwords do not match.");
      return;
    }

    setLoading(true);
    try {
      // getUser validates the current Auth token server-side, and waits for
      // Supabase client URL-session initialization from a genuine invite or
      // recovery link. An arbitrary query string cannot authorize password
      // updates; no session means no updateUser call.
      const { data: identity, error: identityError } = await supabase.auth.getUser();
      if (identityError || !identity.user) {
        toast.error("This invitation or password reset link is invalid or expired. Request a new link from your administrator.");
        return;
      }

      const { error: updateError } = await supabase.auth.updateUser({ password });
      if (updateError) {
        toast.error("We couldn't update your password. Please try again or request a new reset link.");
        return;
      }

      // The password is committed. A subsequent error must not allow a
      // second password update or mislead the user about their session.
      setPasswordSaved(true);
      // End the temporary invitation/recovery session before directing staff
      // to the normal employee sign-in entry (not the Buyer login).
      await finishSignOut();
    } catch {
      toast.error("Password setup could not be completed. Please request a new link.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-background px-4">
      <div className="w-full max-w-sm bg-card border border-border rounded-2xl p-8 shadow-sm space-y-6">
        <div className="text-center">
          <Lock size={32} className="mx-auto text-primary mb-3" />
          <h1 className="text-xl font-bold text-foreground">{isStaffInvite ? "Activate Your Staff Account" : "Reset Your Staff Password"}</h1>
          <p className="text-sm text-muted-foreground mt-1">{isStaffInvite
            ? "Create a password to finish your employee invitation."
            : "Enter a new password for your staff account."}</p>
        </div>

        {done ? (
          <div className="text-center py-6 space-y-2">
            <CheckCircle2 size={40} className="mx-auto text-green-500" />
            <p className="font-bold text-foreground">{isStaffInvite ? "Staff Account Password Set" : "Password Updated"}</p>
            <p className="text-sm text-muted-foreground">Redirecting to staff login…</p>
          </div>
        ) : passwordSaved ? (
          <div className="space-y-4" role="status">
            <p className="text-sm text-foreground font-medium">Your password was saved, but sign-out has not completed.</p>
            <p className="text-xs text-muted-foreground">Retry sign-out to finish securely. Your password will not be changed again.</p>
            <button
              type="button"
              onClick={() => void finishSignOut()}
              disabled={loading}
              className="w-full py-3 bg-primary text-primary-foreground font-bold rounded-xl flex items-center justify-center gap-2 disabled:opacity-50"
            >
              {loading ? <Loader2 size={16} className="animate-spin" /> : "Retry sign out"}
            </button>
          </div>
        ) : (
          <div className="space-y-4">
            <div>
              <label htmlFor="reset-new-password" className="block text-xs font-bold text-muted-foreground uppercase tracking-wider mb-1.5">New Password</label>
              <input
                id="reset-new-password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Min. 6 characters"
                className="w-full bg-muted border border-border rounded-xl p-3 text-sm text-foreground outline-none focus:border-primary focus:ring-1 focus:ring-primary transition-all"
              />
            </div>
            <div>
              <label htmlFor="reset-confirm-password" className="block text-xs font-bold text-muted-foreground uppercase tracking-wider mb-1.5">Confirm Password</label>
              <input
                id="reset-confirm-password"
                type="password"
                value={confirm}
                onChange={(e) => setConfirm(e.target.value)}
                placeholder="Re-enter password"
                className="w-full bg-muted border border-border rounded-xl p-3 text-sm text-foreground outline-none focus:border-primary focus:ring-1 focus:ring-primary transition-all"
              />
            </div>
            <button
              onClick={handleReset}
              disabled={loading || !password || !confirm}
              className="w-full py-3 bg-primary text-primary-foreground font-bold rounded-xl flex items-center justify-center gap-2 shadow-md disabled:opacity-50 transition-all text-sm"
            >
              {loading ? <Loader2 size={16} className="animate-spin" /> : "Update Password"}
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

export default ResetPassword;
