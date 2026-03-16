import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { CheckCircle2, XCircle, Loader2 } from "lucide-react";

interface PendingUser {
  id: string;
  email: string | null;
  name: string | null;
  role: string;
  created_at: string | null;
  company_id: string | null;
  company?: {
    business_name: string;
    gst_number: string | null;
    business_volume: string | null;
  };
}

const AdminApprovals = () => {
  const [users, setUsers] = useState<PendingUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  const fetchPending = async () => {
    setLoading(true);
    // Fetch users with role 'pending' or those without a company_id
    const { data } = await supabase
      .from("users")
      .select("*, company:companies(business_name, gst_number, business_volume)")
      .or("role.eq.pending,company_id.is.null");

    setUsers((data as unknown as PendingUser[]) ?? []);
    setLoading(false);
  };

  useEffect(() => { fetchPending(); }, []);

  const handleApprove = async (user: PendingUser) => {
    setActionLoading(user.id);
    // If user has no company, create one
    let companyId = user.company_id;
    if (!companyId) {
      const { data: newCompany, error: companyErr } = await supabase
        .from("companies")
        .insert({ business_name: user.name ?? user.email ?? "Unknown" })
        .select()
        .single();
      if (companyErr || !newCompany) {
        toast.error("Failed to create company");
        setActionLoading(null);
        return;
      }
      companyId = newCompany.id;
    }

    const { error } = await supabase
      .from("users")
      .update({ role: "buyer", company_id: companyId })
      .eq("id", user.id);

    if (error) toast.error("Failed to approve");
    else {
      toast.success(`Approved ${user.email}`);
      fetchPending();
    }
    setActionLoading(null);
  };

  const handleReject = async (user: PendingUser) => {
    setActionLoading(user.id);
    const { error } = await supabase
      .from("users")
      .update({ role: "rejected" })
      .eq("id", user.id);

    if (error) toast.error("Failed to reject");
    else {
      toast.success(`Rejected ${user.email}`);
      fetchPending();
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

      {users.length === 0 ? (
        <p className="text-[#888] text-sm font-body">No pending applications.</p>
      ) : (
        <div className="rounded-xl overflow-hidden border" style={{ borderColor: "#2a2a2a" }}>
          <table className="w-full text-sm">
            <thead>
              <tr style={{ backgroundColor: "#1a1a1a" }}>
                <th className="text-left px-4 py-3 font-body font-semibold" style={{ color: "#888" }}>Business Name</th>
                <th className="text-left px-4 py-3 font-body font-semibold" style={{ color: "#888" }}>GST Number</th>
                <th className="text-left px-4 py-3 font-body font-semibold" style={{ color: "#888" }}>Volume</th>
                <th className="text-left px-4 py-3 font-body font-semibold" style={{ color: "#888" }}>Date Applied</th>
                <th className="text-right px-4 py-3 font-body font-semibold" style={{ color: "#888" }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {users.map((u) => (
                <tr key={u.id} className="border-t" style={{ borderColor: "#2a2a2a" }}>
                  <td className="px-4 py-3 font-body text-white">{u.company?.business_name ?? u.name ?? u.email ?? "—"}</td>
                  <td className="px-4 py-3 font-body text-[#aaa]">{u.company?.gst_number ?? "—"}</td>
                  <td className="px-4 py-3 font-body text-[#aaa]">{u.company?.business_volume ?? "—"}</td>
                  <td className="px-4 py-3 font-body text-[#aaa]">
                    {u.created_at ? new Date(u.created_at).toLocaleDateString() : "—"}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <div className="flex items-center justify-end gap-2">
                      <button
                        onClick={() => handleApprove(u)}
                        disabled={actionLoading === u.id}
                        className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-green-600/20 text-green-400 hover:bg-green-600/30 transition-colors disabled:opacity-50"
                      >
                        <CheckCircle2 size={14} /> Approve
                      </button>
                      <button
                        onClick={() => handleReject(u)}
                        disabled={actionLoading === u.id}
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
