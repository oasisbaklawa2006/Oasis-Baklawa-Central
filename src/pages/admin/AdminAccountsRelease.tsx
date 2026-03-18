import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Loader2, ChevronDown, Check, AlertTriangle, Ban, CheckCircle2 } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { useLanguage } from "@/hooks/useLanguage";
import { useCurrency } from "@/hooks/useCurrency";

interface FinanceOrder {
  id: string; status: string; payment_status: string | null;
  sales_order_value: number | null; advance_paid: number | null;
  advance_required: number | null; company_id: string | null;
  company?: { business_name: string } | null;
}

type PaymentAction = "request_advance" | "mark_advance_paid" | "request_balance" | "mark_fully_paid";

const ACTION_LABELS: Record<PaymentAction, string> = {
  request_advance: "Request 50% Advance",
  mark_advance_paid: "Mark Advance Paid",
  request_balance: "Request Final Balance",
  mark_fully_paid: "Mark Fully Paid",
};

function getAvailableActions(order: FinanceOrder): PaymentAction[] {
  const actions: PaymentAction[] = [];
  const advReq = order.advance_required ?? 0;
  const advPaid = order.advance_paid ?? 0;
  if (advReq === 0) actions.push("request_advance");
  if (advReq > 0 && advPaid < advReq) actions.push("mark_advance_paid");
  if (advPaid >= advReq && advReq > 0 && order.payment_status !== "paid") actions.push("request_balance");
  if (order.payment_status !== "paid" && advPaid > 0) actions.push("mark_fully_paid");
  return actions;
}

type ReleaseStatus = "advance_pending" | "balance_pending" | "finance_hold" | "cleared" | "paid";

function getReleaseStatus(order: FinanceOrder): ReleaseStatus {
  const advReq = order.advance_required ?? 0;
  const advPaid = order.advance_paid ?? 0;
  const total = order.sales_order_value ?? 0;
  if (order.payment_status === "paid") return "paid";
  if (advReq === 0) return "advance_pending";
  if (advPaid < advReq) return "finance_hold";
  if (advPaid >= advReq && (total - advPaid) > 0) return "balance_pending";
  return "cleared";
}

const RELEASE_LABELS: Record<ReleaseStatus, { label: string; color: string }> = {
  advance_pending: { label: "Advance Pending", color: "bg-amber-100 text-amber-700" },
  balance_pending: { label: "Balance Pending", color: "bg-blue-100 text-blue-700" },
  finance_hold: { label: "Finance Hold", color: "bg-destructive/10 text-destructive" },
  cleared: { label: "Cleared", color: "bg-green-100 text-green-700" },
  paid: { label: "Fully Paid", color: "bg-green-100 text-green-700" },
};

const AdminAccountsRelease = () => {
  const [orders, setOrders] = useState<FinanceOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [acting, setActing] = useState<string | null>(null);
  const [openDropdown, setOpenDropdown] = useState<string | null>(null);
  const [tab, setTab] = useState<"all" | "hold" | "overdue">("all");
  const { user } = useAuth();
  const { t } = useLanguage();
  const { format } = useCurrency();

  const fetchOrders = async () => {
    setLoading(true);
    const { data } = await supabase
      .from("orders")
      .select("id, status, payment_status, sales_order_value, advance_paid, advance_required, company_id, company:companies(business_name)")
      .neq("payment_status", "paid")
      .order("created_at", { ascending: false });
    setOrders((data as unknown as FinanceOrder[]) ?? []);
    setLoading(false);
  };

  useEffect(() => { fetchOrders(); }, []);

  const handleAction = async (order: FinanceOrder, action: PaymentAction) => {
    setActing(order.id); setOpenDropdown(null);
    const total = order.sales_order_value ?? 0;
    const advPaid = order.advance_paid ?? 0;
    try {
      if (action === "request_advance") {
        const amt = Math.round(total * 0.5);
        await supabase.from("orders").update({ advance_required: amt }).eq("id", order.id);
        toast.success(`50% advance of ${format(amt)} requested`);
      } else if (action === "mark_advance_paid") {
        const advReq = order.advance_required ?? 0;
        await supabase.from("order_payments").insert({ order_id: order.id, company_id: order.company_id, payment_type: "advance", amount: advReq, created_by: user?.id ?? null });
        await supabase.from("orders").update({ advance_paid: advReq, status: "in_production", payment_status: "advance_paid" }).eq("id", order.id);
        await supabase.from("order_status_history").insert({ order_id: order.id, old_status: order.status, new_status: "in_production" });
        toast.success("Advance paid — released to Production");
      } else if (action === "request_balance") {
        toast.success(`Balance of ${format(total - advPaid)} requested`);
      } else if (action === "mark_fully_paid") {
        const due = total - advPaid;
        await supabase.from("order_payments").insert({ order_id: order.id, company_id: order.company_id, payment_type: "balance", amount: due, created_by: user?.id ?? null });
        await supabase.from("orders").update({ payment_status: "paid", closed_at: new Date().toISOString() }).eq("id", order.id);
        toast.success("Fully paid");
      }
      await supabase.from("audit_logs").insert({ action_type: `finance_${action}`, module_name: "Finance", entity_name: "order", entity_id: order.id, actor_id: user?.id });
      fetchOrders();
    } catch { toast.error("Action failed"); }
    setActing(null);
  };

  // Summary counts
  const holdCount = orders.filter(o => getReleaseStatus(o) === "finance_hold").length;
  const advPendingCount = orders.filter(o => getReleaseStatus(o) === "advance_pending").length;
  const balPendingCount = orders.filter(o => getReleaseStatus(o) === "balance_pending").length;
  const totalDue = orders.reduce((s, o) => s + ((o.sales_order_value ?? 0) - (o.advance_paid ?? 0)), 0);
  const dispatchBlocked = orders.filter(o => ["ready_for_dispatch", "packing"].includes(o.status) && getReleaseStatus(o) === "finance_hold").length;

  const filtered = tab === "hold" ? orders.filter(o => getReleaseStatus(o) === "finance_hold")
    : tab === "overdue" ? orders.filter(o => getReleaseStatus(o) === "balance_pending")
    : orders;

  if (loading) return <div className="flex items-center justify-center py-20"><Loader2 size={24} className="animate-spin text-primary" /></div>;

  return (
    <div className="space-y-6">
      <h1 className="text-display-h2 text-foreground">{t("Accounts & Release")}</h1>

      {/* Summary */}
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
        {[
          { label: "Advance Pending", value: advPendingCount, color: "text-amber-600" },
          { label: "Balance Pending", value: balPendingCount, color: "text-blue-600" },
          { label: "Finance Hold", value: holdCount, color: "text-destructive" },
          { label: "Dispatch Blocked", value: dispatchBlocked, color: "text-destructive" },
          { label: "Total Outstanding", value: format(totalDue), color: "text-primary" },
        ].map(m => (
          <div key={m.label} className="bg-card border border-border rounded-xl p-4 text-center" style={{ boxShadow: "0 1px 6px rgba(0,0,0,0.04)" }}>
            <p className={`text-ui-kpi text-lg ${m.color}`}>{m.value}</p>
            <p className="text-fine text-muted-foreground mt-1">{m.label}</p>
          </div>
        ))}
      </div>

      {/* Tabs */}
      <div className="flex gap-2">
        {[
          { key: "all" as const, label: "All Orders", count: orders.length },
          { key: "hold" as const, label: "Finance Hold", count: holdCount },
          { key: "overdue" as const, label: "Balance Due", count: balPendingCount },
        ].map(tb => (
          <button key={tb.key} onClick={() => setTab(tb.key)}
            className={`px-4 py-2 rounded-lg text-ui-button transition-colors ${tab === tb.key ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground hover:text-foreground"}`}>
            {tb.label} ({tb.count})
          </button>
        ))}
      </div>

      {/* Table */}
      {filtered.length === 0 ? (
        <p className="text-ui-label text-muted-foreground">No pending payments.</p>
      ) : (
        <div className="rounded-xl overflow-visible border border-border bg-card" style={{ boxShadow: "0 2px 12px rgba(0,0,0,0.06)" }}>
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-muted/50">
                <th className="text-left px-4 py-3 text-ui-label text-muted-foreground">{t("Company")}</th>
                <th className="text-left px-4 py-3 text-ui-label text-muted-foreground">Order</th>
                <th className="text-left px-4 py-3 text-ui-label text-muted-foreground">Release Status</th>
                <th className="text-right px-4 py-3 text-ui-label text-muted-foreground">{t("Advance Required")}</th>
                <th className="text-right px-4 py-3 text-ui-label text-muted-foreground">{t("Advance Paid")}</th>
                <th className="text-right px-4 py-3 text-ui-label text-muted-foreground">{t("Sales Order Value")}</th>
                <th className="text-right px-4 py-3 text-ui-label text-muted-foreground">{t("Balance Due")}</th>
                <th className="text-right px-4 py-3 text-ui-label text-muted-foreground">{t("Actions")}</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map(order => {
                const due = (order.sales_order_value ?? 0) - (order.advance_paid ?? 0);
                const rs = getReleaseStatus(order);
                const rl = RELEASE_LABELS[rs];
                const actions = getAvailableActions(order);
                return (
                  <tr key={order.id} className="border-t border-border">
                    <td className="px-4 py-3 text-ui-cell text-foreground">{order.company?.business_name ?? "—"}</td>
                    <td className="px-4 py-3 text-ui-cell text-muted-foreground text-xs">{order.id.slice(0, 8)}…</td>
                    <td className="px-4 py-3"><span className={`px-2 py-1 rounded-full text-xs font-semibold ${rl.color}`}>{rl.label}</span></td>
                    <td className="px-4 py-3 text-right text-ui-cell text-muted-foreground">{format(order.advance_required ?? 0)}</td>
                    <td className="px-4 py-3 text-right text-ui-cell text-green-600">{format(order.advance_paid ?? 0)}</td>
                    <td className="px-4 py-3 text-right text-ui-cell text-foreground">{format(order.sales_order_value ?? 0)}</td>
                    <td className="px-4 py-3 text-right text-ui-kpi text-sm text-primary">{format(due)}</td>
                    <td className="px-4 py-3 text-right">
                      {actions.length > 0 ? (
                        <div className="relative inline-block">
                          <button onClick={() => setOpenDropdown(openDropdown === order.id ? null : order.id)} disabled={acting === order.id}
                            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-ui-button bg-primary/10 text-primary hover:bg-primary/20 disabled:opacity-50">
                            {acting === order.id ? <Loader2 size={14} className="animate-spin" /> : <ChevronDown size={14} />} {t("Actions")}
                          </button>
                          {openDropdown === order.id && (
                            <div className="absolute right-0 top-full mt-1 w-52 bg-card rounded-xl shadow-lg border border-border py-1 z-50">
                              {actions.map(a => (
                                <button key={a} onClick={() => handleAction(order, a)} className="w-full text-left px-4 py-2.5 text-sm font-ui text-foreground hover:bg-muted transition-colors">{ACTION_LABELS[a]}</button>
                              ))}
                            </div>
                          )}
                        </div>
                      ) : (
                        <span className="text-ui-label text-muted-foreground flex items-center gap-1 justify-end"><Check size={14} /> Paid</span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};

export default AdminAccountsRelease;
