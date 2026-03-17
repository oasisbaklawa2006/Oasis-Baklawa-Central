import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Loader2, CheckCircle2 } from "lucide-react";

interface Ticket {
  id: string;
  order_id: string;
  issue_type: string;
  description: string;
  status: string | null;
  created_at: string | null;
}

const AdminSupport = () => {
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [loading, setLoading] = useState(true);
  const [resolving, setResolving] = useState<string | null>(null);

  const fetchTickets = async () => {
    setLoading(true);
    const { data } = await supabase
      .from("support_tickets")
      .select("*")
      .order("created_at", { ascending: false });
    setTickets((data as Ticket[]) ?? []);
    setLoading(false);
  };

  useEffect(() => { fetchTickets(); }, []);

  const handleResolve = async (id: string) => {
    setResolving(id);
    const { error } = await supabase
      .from("support_tickets")
      .update({ status: "resolved" })
      .eq("id", id);
    if (error) toast.error("Failed to update");
    else { toast.success("Ticket resolved"); fetchTickets(); }
    setResolving(null);
  };

  const fmtDate = (d: string | null) => d ? new Date(d).toLocaleDateString("en-IN") : "—";

  if (loading) {
    return <div className="flex items-center justify-center py-20"><Loader2 size={24} className="animate-spin text-primary" /></div>;
  }

  return (
    <div className="space-y-6">
      <h1 className="text-display-h2 text-primary">Support Tickets</h1>

      {tickets.length === 0 ? (
        <p className="text-ui-label text-[#888]">No support tickets.</p>
      ) : (
        <div className="rounded-xl overflow-hidden border" style={{ borderColor: "#2a2a2a" }}>
          <table className="w-full">
            <thead>
              <tr style={{ backgroundColor: "#1a1a1a" }}>
                <th className="text-left px-4 py-3 text-ui-label text-[#888]">Date</th>
                <th className="text-left px-4 py-3 text-ui-label text-[#888]">Order ID</th>
                <th className="text-left px-4 py-3 text-ui-label text-[#888]">Issue Type</th>
                <th className="text-left px-4 py-3 text-ui-label text-[#888]">Description</th>
                <th className="text-left px-4 py-3 text-ui-label text-[#888]">Status</th>
                <th className="text-right px-4 py-3 text-ui-label text-[#888]">Action</th>
              </tr>
            </thead>
            <tbody>
              {tickets.map((t) => (
                <tr key={t.id} className="border-t" style={{ borderColor: "#2a2a2a" }}>
                  <td className="px-4 py-3 text-ui-cell text-[#aaa]">{fmtDate(t.created_at)}</td>
                  <td className="px-4 py-3 text-ui-cell text-[#aaa]">{t.order_id.slice(0, 8)}…</td>
                  <td className="px-4 py-3 text-ui-cell text-white">{t.issue_type}</td>
                  <td className="px-4 py-3 text-ui-cell text-[#aaa] max-w-[200px] truncate">{t.description}</td>
                  <td className="px-4 py-3">
                    <span className={`text-ui-label px-2 py-1 rounded-full ${t.status === "resolved" ? "bg-emerald-500/20 text-emerald-400" : "bg-amber-500/20 text-amber-400"}`}>
                      {t.status ?? "open"}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right">
                    {t.status !== "resolved" && (
                      <button
                        onClick={() => handleResolve(t.id)}
                        disabled={resolving === t.id}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-ui-button bg-emerald-500/20 text-emerald-400 hover:bg-emerald-500/30 transition-colors disabled:opacity-50"
                      >
                        {resolving === t.id ? <Loader2 size={14} className="animate-spin" /> : <CheckCircle2 size={14} />}
                        Mark Resolved
                      </button>
                    )}
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

export default AdminSupport;
