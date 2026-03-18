import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Loader2, CheckCircle2 } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";

interface Ticket {
  id: string;
  order_id: string;
  issue_type: string;
  description: string;
  status: string | null;
  created_at: string | null;
}

const AdminSupport = () => {
  const { user } = useAuth();
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
      <h1 className="text-display-h2 text-foreground">Support Tickets</h1>

      {tickets.length === 0 ? (
        <p className="text-ui-label text-muted-foreground">No support tickets.</p>
      ) : (
        <div className="rounded-xl overflow-hidden border border-border bg-card" style={{ boxShadow: "0 2px 12px rgba(0,0,0,0.06)" }}>
          <table className="w-full">
            <thead>
              <tr className="bg-muted/50">
                <th className="text-left px-4 py-3 text-ui-label text-muted-foreground">Date</th>
                <th className="text-left px-4 py-3 text-ui-label text-muted-foreground">Order ID</th>
                <th className="text-left px-4 py-3 text-ui-label text-muted-foreground">Issue Type</th>
                <th className="text-left px-4 py-3 text-ui-label text-muted-foreground">Description</th>
                <th className="text-left px-4 py-3 text-ui-label text-muted-foreground">Status</th>
                <th className="text-right px-4 py-3 text-ui-label text-muted-foreground">Action</th>
              </tr>
            </thead>
            <tbody>
              {tickets.map((t) => (
                <tr key={t.id} className="border-t border-border">
                  <td className="px-4 py-3 text-ui-cell text-muted-foreground">{fmtDate(t.created_at)}</td>
                  <td className="px-4 py-3 text-ui-cell text-muted-foreground">{t.order_id.slice(0, 8)}…</td>
                  <td className="px-4 py-3 text-ui-cell text-foreground">{t.issue_type}</td>
                  <td className="px-4 py-3 text-ui-cell text-muted-foreground max-w-[200px] truncate">{t.description}</td>
                  <td className="px-4 py-3">
                    <span className={`text-ui-label px-2 py-1 rounded-full ${t.status === "resolved" ? "bg-green-100 text-green-700" : "bg-amber-100 text-amber-700"}`}>
                      {t.status ?? "open"}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right">
                    {t.status !== "resolved" && (
                      <button
                        onClick={() => handleResolve(t.id)}
                        disabled={resolving === t.id}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-ui-button bg-green-100 text-green-700 hover:bg-green-200 transition-colors disabled:opacity-50"
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
