import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { CheckCircle2, XCircle, Loader2 } from "lucide-react";
import { processOutboxQueue } from "@/utils/notificationOutbox";

interface Application {
  id: string;
  business_name: string;
  gst_number: string | null;
  expected_volume: string | null;
  contact_name: string | null;
  contact_email: string | null;
  status: string;
  created_at: string | null;
  user_id: string | null;
}

const AdminApprovals = () => {
  const [apps, setApps] = useState<Application[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  const fetchApps = async () => {
    setLoading(true);
    const { data } = await supabase
      .from("b2b_applications")
      .select("*")
      .eq("status", "pending")
      .order("created_at", { ascending: false });
    setApps((data as Application[]) ?? []);
    setLoading(false);
  };

  useEffect(() => { fetchApps(); }, []);

  const handleAction = async (app: Application, newStatus: "approved" | "rejected") => {
    setActionLoading(app.id);

    try {
      // Step 1: Update application status
      const { error } = await supabase
        .from("b2b_applications")
        .update({ status: newStatus })
        .eq("id", app.id);

      if (error) {
        console.error("[Approve] Application update failed:", error);
        toast.error(`Failed to ${newStatus === "approved" ? "approve" : "reject"}`);
        setActionLoading(null);
        return;
      }

      if (newStatus === "rejected") {
        toast.success(`${app.business_name} rejected`);
        fetchApps();
        setActionLoading(null);
        return;
      }

      // === ATOMIC APPROVAL SEQUENCE ===

      // Guard: Ensure auth account exists
      if (!app.user_id) {
        toast.error("Incomplete Registration: No Auth Account Found. Cannot approve.");
        setActionLoading(null);
        return;
      }

      // Step 2: Profile validation — ensure user has a profile record
        const { data: existingProfile } = await supabase
          .from("profiles")
          .select("id")
          .eq("id", app.user_id)
          .maybeSingle();

        if (!existingProfile) {
          console.warn("[Approve] No profile found for user_id:", app.user_id, "— creating placeholder");
          await supabase.from("profiles").insert({
            id: app.user_id,
            email: app.contact_email,
            full_name: app.contact_name,
            role: "buyer",
            is_approved: true,
          });
        } else {
          // Update existing profile to approved
          await supabase
            .from("profiles")
            .update({ role: "buyer", is_approved: true } as any)
            .eq("id", app.user_id);
        }
      }

      // Step 2: Create company & update users table
      if (app.user_id) {
        const { data: newCompany } = await supabase
          .from("companies")
          .insert({
            business_name: app.business_name,
            gst_number: app.gst_number,
            business_volume: app.expected_volume,
          })
          .select()
          .single();

        if (newCompany) {
          await supabase
            .from("users")
            .update({ role: "buyer", company_id: newCompany.id })
            .eq("id", app.user_id);

          // Also link profile to company
          await supabase
            .from("profiles")
            .update({ company_id: newCompany.id } as any)
            .eq("id", app.user_id);
        }
      }

      // Step 3: Direct notification injection
      let emailSent = false;
      if (app.contact_email) {
        const { error: outboxError } = await supabase.from("notification_outbox").insert({
          recipient_email: app.contact_email,
          event_type: "portal_activation",
          message_body: "Welcome to the Oasis Baklawa B2B Portal. Your account is now active. You can now log in to view our catalog and place orders.",
          status: "pending",
        });

        if (outboxError) {
          console.error("[Approve] Outbox insert failed:", outboxError);
        } else {
          // Step 4: Force dispatch — invoke send-email directly
          try {
            const { error: fnError } = await supabase.functions.invoke("send-email", {
              body: {
                to: app.contact_email,
                subject: "Your Oasis Baklawa B2B Account is Active!",
                text: "Welcome to the Oasis Baklawa B2B Portal. Your account is now active. You can now log in to view our catalog and place orders.",
              },
            });

            if (fnError) {
              console.error("[Approve] Edge Function failed:", fnError);
              toast.error("User approved, but welcome email failed to send. Please use the Resend Email button manually.");
            } else {
              emailSent = true;
              // Mark outbox entry as sent
              await supabase
                .from("notification_outbox")
                .update({ status: "sent", sent_at: new Date().toISOString() } as any)
                .eq("recipient_email", app.contact_email)
                .eq("event_type", "portal_activation")
                .eq("status", "pending");
            }
          } catch (fnErr: any) {
            console.error("[Approve] Edge Function exception:", fnErr);
            toast.error("User approved, but welcome email failed to send. Please use the Resend Email button manually.");
          }
        }
      }

      if (emailSent) {
        toast.success(`${app.business_name} approved & welcome email sent!`);
      } else if (!app.contact_email) {
        toast.success(`${app.business_name} approved (no email on file)`);
      }

      fetchApps();
    } catch (err: any) {
      console.error("[Approve] Atomic approval failed:", err);
      toast.error("Approval failed: " + (err.message || "Unknown error"));
    }

    setActionLoading(null);
  };

  if (loading) {
    return <div className="flex items-center justify-center py-20"><Loader2 size={24} className="animate-spin text-primary" /></div>;
  }

  return (
    <div className="space-y-6">
      <h1 className="text-display-h2 text-primary">B2B Approvals</h1>

      {apps.length === 0 ? (
        <p className="text-ui-label text-muted-foreground">No pending applications.</p>
      ) : (
        <div className="rounded-xl overflow-hidden border border-border bg-white" style={{ boxShadow: "0 2px 12px rgba(0,0,0,0.06)" }}>
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-muted/50">
                <th className="text-left px-4 py-3 text-ui-label text-muted-foreground">Business Name</th>
                <th className="text-left px-4 py-3 text-ui-label text-muted-foreground">GST Number</th>
                <th className="text-left px-4 py-3 text-ui-label text-muted-foreground">Expected Volume</th>
                <th className="text-left px-4 py-3 text-ui-label text-muted-foreground">Date Applied</th>
                <th className="text-left px-4 py-3 text-ui-label text-muted-foreground">Status</th>
                <th className="text-right px-4 py-3 text-ui-label text-muted-foreground">Actions</th>
              </tr>
            </thead>
            <tbody>
              {apps.map((a) => (
                <tr key={a.id} className="border-t border-border">
                  <td className="px-4 py-3 text-ui-cell text-foreground">{a.business_name}</td>
                  <td className="px-4 py-3 text-ui-cell text-muted-foreground">{a.gst_number ?? "—"}</td>
                  <td className="px-4 py-3 text-ui-cell text-muted-foreground">{a.expected_volume ?? "—"}</td>
                  <td className="px-4 py-3 text-ui-cell text-muted-foreground">
                    {a.created_at ? new Date(a.created_at).toLocaleDateString() : "—"}
                  </td>
                  <td className="px-4 py-3">
                    <span className="px-2 py-1 rounded-full text-xs font-semibold bg-amber-100 text-amber-700">{a.status}</span>
                  </td>
                  <td className="px-4 py-3 text-right">
                    <div className="flex items-center justify-end gap-2">
                      <button
                        onClick={() => handleAction(a, "approved")}
                        disabled={actionLoading === a.id}
                        className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-green-100 text-green-700 hover:bg-green-200 transition-colors disabled:opacity-50"
                      >
                         {actionLoading === a.id ? <Loader2 size={14} className="animate-spin" /> : <CheckCircle2 size={14} />}
                         {actionLoading === a.id ? "Approving & Sending…" : "Approve"}
                      </button>
                      <button
                        onClick={() => handleAction(a, "rejected")}
                        disabled={actionLoading === a.id}
                        className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-red-100 text-red-700 hover:bg-red-200 transition-colors disabled:opacity-50"
                      >
                        <XCircle size={14} /> Reject
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};

export default AdminApprovals;
