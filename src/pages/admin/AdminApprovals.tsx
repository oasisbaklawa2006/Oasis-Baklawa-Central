import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { CheckCircle2, XCircle, Loader2 } from "lucide-react";

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
    const { error } = await supabase
      .from("b2b_applications")
      .update({ status: newStatus })
      .eq("id", app.id);

    if (error) {
      toast.error(`Failed to ${newStatus === "approved" ? "approve" : "reject"}`);
    } else {
      toast.success(`${app.business_name} ${newStatus}`);
      // If approved and user_id exists, update user role to buyer and create company
      if (newStatus === "approved" && app.user_id) {
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
        }
      }
      fetchApps();
    }
    setActionLoading(null);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 size={24} className="animate-spin" style={{ color: "#c6a769" }} />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <h1 className="font-display text-2xl" style={{ color: "#c6a769" }}>B2B Approvals</h1>

      {apps.length === 0 ? (
        <p className="text-[#888] text-sm font-body">No pending applications.</p>
      ) : (
        <div className="rounded-xl overflow-hidden border" style={{ borderColor: "#2a2a2a" }}>
          <table className="w-full text-sm">
            <thead>
              <tr style={{ backgroundColor: "#1a1a1a" }}>
                <th className="text-left px-4 py-3 font-body font-semibold" style={{ color: "#888" }}>Business Name</th>
                <th className="text-left px-4 py-3 font-body font-semibold" style={{ color: "#888" }}>GST Number</th>
                <th className="text-left px-4 py-3 font-body font-semibold" style={{ color: "#888" }}>Expected Volume</th>
                <th className="text-left px-4 py-3 font-body font-semibold" style={{ color: "#888" }}>Date Applied</th>
                <th className="text-left px-4 py-3 font-body font-semibold" style={{ color: "#888" }}>Status</th>
                <th className="text-right px-4 py-3 font-body font-semibold" style={{ color: "#888" }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {apps.map((a) => (
                <tr key={a.id} className="border-t" style={{ borderColor: "#2a2a2a" }}>
                  <td className="px-4 py-3 font-body text-white">{a.business_name}</td>
                  <td className="px-4 py-3 font-body text-[#aaa]">{a.gst_number ?? "—"}</td>
                  <td className="px-4 py-3 font-body text-[#aaa]">{a.expected_volume ?? "—"}</td>
                  <td className="px-4 py-3 font-body text-[#aaa]">
                    {a.created_at ? new Date(a.created_at).toLocaleDateString() : "—"}
                  </td>
                  <td className="px-4 py-3">
                    <span className="px-2 py-1 rounded-full text-xs font-semibold bg-yellow-500/20 text-yellow-400">
                      {a.status}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right">
                    <div className="flex items-center justify-end gap-2">
                      <button
                        onClick={() => handleAction(a, "approved")}
                        disabled={actionLoading === a.id}
                        className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-green-600/20 text-green-400 hover:bg-green-600/30 transition-colors disabled:opacity-50"
                      >
                        <CheckCircle2 size={14} /> Approve
                      </button>
                      <button
                        onClick={() => handleAction(a, "rejected")}
                        disabled={actionLoading === a.id}
                        className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-red-600/20 text-red-400 hover:bg-red-600/30 transition-colors disabled:opacity-50"
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
