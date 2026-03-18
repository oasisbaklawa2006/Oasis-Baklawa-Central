import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Loader2, AlertTriangle, Ban, FileWarning, Headphones, Scale } from "lucide-react";
import { useLanguage } from "@/hooks/useLanguage";

interface SupportTicket {
  id: string; order_id: string; issue_type: string; description: string;
  status: string | null; created_at: string | null;
}

interface MoqRule {
  id: string; rule_scope: string; min_quantity: number | null;
  validation_mode: string | null; is_active: boolean | null;
}

const AdminExceptions = () => {
  const [tickets, setTickets] = useState<SupportTicket[]>([]);
  const [moqRules, setMoqRules] = useState<MoqRule[]>([]);
  const [cancelledOrders, setCancelledOrders] = useState<{ id: string; company?: { business_name: string } | null; status: string }[]>([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<"escalations" | "moq" | "cancellations">("escalations");
  const { t } = useLanguage();

  useEffect(() => {
    const fetch = async () => {
      const [ticketRes, moqRes, cancelRes] = await Promise.all([
        supabase.from("support_tickets").select("*").eq("status", "open").order("created_at", { ascending: false }),
        supabase.from("moq_rules").select("*").eq("is_active", true),
        supabase.from("orders").select("id, status, company:companies(business_name)").eq("status", "cancelled").limit(50),
      ]);
      setTickets((ticketRes.data as SupportTicket[]) ?? []);
      setMoqRules((moqRes.data as MoqRule[]) ?? []);
      setCancelledOrders((cancelRes.data as any[]) ?? []);
      setLoading(false);
    };
    fetch();
  }, []);

  const fmtDate = (d: string | null) => d ? new Date(d).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "2-digit" }) : "—";

  if (loading) return <div className="flex items-center justify-center py-20"><Loader2 size={24} className="animate-spin text-primary" /></div>;

  const categories = [
    { key: "escalations" as const, label: "Support Escalations", icon: Headphones, count: tickets.length },
    { key: "moq" as const, label: "MOQ Exceptions", icon: Scale, count: moqRules.filter(r => r.validation_mode === "warning").length },
    { key: "cancellations" as const, label: "Cancellations", icon: Ban, count: cancelledOrders.length },
  ];

  return (
    <div className="space-y-6">
      <h1 className="text-display-h2 text-foreground">{t("Exception Center")}</h1>

      {/* Summary cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        {categories.map(c => (
          <button key={c.key} onClick={() => setTab(c.key)}
            className={`bg-card border rounded-xl p-4 text-left transition-all ${tab === c.key ? "border-primary shadow-md" : "border-border"}`}
            style={{ boxShadow: "0 1px 6px rgba(0,0,0,0.04)" }}>
            <div className="flex items-center justify-between mb-2">
              <c.icon size={18} className="text-primary" />
              <span className="text-ui-kpi text-lg text-primary">{c.count}</span>
            </div>
            <h3 className="text-ui-h5 text-foreground">{c.label}</h3>
          </button>
        ))}
      </div>

      {/* Content */}
      {tab === "escalations" && (
        <div className="rounded-xl border border-border bg-card overflow-hidden" style={{ boxShadow: "0 2px 12px rgba(0,0,0,0.06)" }}>
          {tickets.length === 0 ? <p className="p-6 text-ui-label text-muted-foreground">No open escalations.</p> : (
            <table className="w-full text-sm">
              <thead><tr className="bg-muted/50">
                <th className="text-left px-4 py-3 text-ui-label text-muted-foreground">Date</th>
                <th className="text-left px-4 py-3 text-ui-label text-muted-foreground">Order</th>
                <th className="text-left px-4 py-3 text-ui-label text-muted-foreground">Type</th>
                <th className="text-left px-4 py-3 text-ui-label text-muted-foreground">Description</th>
              </tr></thead>
              <tbody>
                {tickets.map(t => (
                  <tr key={t.id} className="border-t border-border">
                    <td className="px-4 py-3 text-ui-cell text-muted-foreground">{fmtDate(t.created_at)}</td>
                    <td className="px-4 py-3 text-ui-cell text-foreground">{t.order_id.slice(0, 8)}…</td>
                    <td className="px-4 py-3"><span className="px-2 py-1 rounded-full text-xs font-semibold bg-destructive/10 text-destructive">{t.issue_type}</span></td>
                    <td className="px-4 py-3 text-ui-cell text-muted-foreground truncate max-w-[200px]">{t.description}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}

      {tab === "moq" && (
        <div className="rounded-xl border border-border bg-card overflow-hidden" style={{ boxShadow: "0 2px 12px rgba(0,0,0,0.06)" }}>
          {moqRules.length === 0 ? <p className="p-6 text-ui-label text-muted-foreground">No MOQ rules configured.</p> : (
            <table className="w-full text-sm">
              <thead><tr className="bg-muted/50">
                <th className="text-left px-4 py-3 text-ui-label text-muted-foreground">Scope</th>
                <th className="text-left px-4 py-3 text-ui-label text-muted-foreground">Min Qty</th>
                <th className="text-left px-4 py-3 text-ui-label text-muted-foreground">Mode</th>
              </tr></thead>
              <tbody>
                {moqRules.map(r => (
                  <tr key={r.id} className="border-t border-border">
                    <td className="px-4 py-3 text-ui-cell text-foreground">{r.rule_scope}</td>
                    <td className="px-4 py-3 text-ui-cell text-foreground">{r.min_quantity ?? "—"}</td>
                    <td className="px-4 py-3">
                      <span className={`px-2 py-1 rounded-full text-xs font-semibold ${r.validation_mode === "warning" ? "bg-amber-100 text-amber-700" : "bg-destructive/10 text-destructive"}`}>
                        {r.validation_mode ?? "hard_stop"}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}

      {tab === "cancellations" && (
        <div className="rounded-xl border border-border bg-card overflow-hidden" style={{ boxShadow: "0 2px 12px rgba(0,0,0,0.06)" }}>
          {cancelledOrders.length === 0 ? <p className="p-6 text-ui-label text-muted-foreground">No cancelled orders.</p> : (
            <table className="w-full text-sm">
              <thead><tr className="bg-muted/50">
                <th className="text-left px-4 py-3 text-ui-label text-muted-foreground">Order ID</th>
                <th className="text-left px-4 py-3 text-ui-label text-muted-foreground">Company</th>
                <th className="text-left px-4 py-3 text-ui-label text-muted-foreground">Status</th>
              </tr></thead>
              <tbody>
                {cancelledOrders.map(o => (
                  <tr key={o.id} className="border-t border-border">
                    <td className="px-4 py-3 text-ui-cell text-foreground">{o.id.slice(0, 8)}…</td>
                    <td className="px-4 py-3 text-ui-cell text-muted-foreground">{o.company?.business_name ?? "—"}</td>
                    <td className="px-4 py-3"><span className="px-2 py-1 rounded-full text-xs font-semibold bg-destructive/10 text-destructive">{o.status}</span></td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}
    </div>
  );
};

export default AdminExceptions;
