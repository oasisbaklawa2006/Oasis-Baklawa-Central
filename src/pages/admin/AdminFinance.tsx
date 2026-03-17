import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Loader2, ChevronDown, Check } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";

interface FinanceOrder {
  id: string;
  status: string;
  payment_status: string | null;
  sales_order_value: number | null;
  advance_paid: number | null;
  advance_required: number | null;
  company_id: string | null;
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
  const total = order.sales_order_value ?? 0;

  if (advReq === 0) actions.push("request_advance");
  if (advReq > 0 && advPaid < advReq) actions.push("mark_advance_paid");
  if (advPaid >= advReq && advReq > 0 && order.payment_status !== "paid") actions.push("request_balance");
  if (order.payment_status !== "paid" && advPaid > 0) actions.push("mark_fully_paid");

  return actions;
}

const AdminFinance = () => {
  const [orders, setOrders] = useState<FinanceOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [acting, setActing] = useState<string | null>(null);
  const [openDropdown, setOpenDropdown] = useState<string | null>(null);
  const { user } = useAuth();

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
    setActing(order.id);
    setOpenDropdown(null);
    const total = order.sales_order_value ?? 0;
    const advPaid = order.advance_paid ?? 0;

    try {
      if (action === "request_advance") {
        const advanceAmt = Math.round(total * 0.5);
        await supabase.from("orders").update({ advance_required: advanceAmt }).eq("id", order.id);
        toast.success(`50% advance of ₹${advanceAmt.toLocaleString("en-IN")} requested`);
      } else if (action === "mark_advance_paid") {
        const advReq = order.advance_required ?? 0;
        await supabase.from("order_payments").insert({
          order_id: order.id,
          company_id: order.company_id,
          payment_type: "advance",
          amount: advReq,
          created_by: user?.id ?? null,
        });
        await supabase.from("orders").update({
          advance_paid: advReq,
          status: "in_production",
          payment_status: "advance_paid",
        }).eq("id", order.id);
        toast.success("Advance marked as paid — order moved to Production");
      } else if (action === "request_balance") {
        toast.success(`Final balance of ₹${(total - advPaid).toLocaleString("en-IN")} requested from buyer`);
      } else if (action === "mark_fully_paid") {
        const due = total - advPaid;
        await supabase.from("order_payments").insert({
          order_id: order.id,
          company_id: order.company_id,
          payment_type: "balance",
          amount: due,
          created_by: user?.id ?? null,
        });
        await supabase.from("orders").update({
          payment_status: "paid",
          closed_at: new Date().toISOString(),
        }).eq("id", order.id);
        toast.success("Order marked as fully paid");
      }
      fetchOrders();
    } catch (err) {
      toast.error("Action failed");
    }
    setActing(null);
  };

  const fmt = (n: number | null) => `₹${(n ?? 0).toLocaleString("en-IN")}`;

  if (loading) {
    return <div className="flex items-center justify-center py-20"><Loader2 size={24} className="animate-spin text-primary" /></div>;
  }

  return (
    <div className="space-y-6">
      <h1 className="text-display-h2 text-primary">Payment Reconciliation</h1>

      {orders.length === 0 ? (
        <p className="text-ui-label text-muted-foreground">No pending payments.</p>
      ) : (
        <div className="rounded-xl overflow-visible border border-border bg-white" style={{ boxShadow: "0 2px 12px rgba(0,0,0,0.06)" }}>
          <table className="w-full">
            <thead>
              <tr className="bg-muted/50">
                <th className="text-left px-4 py-3 text-ui-label text-muted-foreground">Company</th>
                <th className="text-left px-4 py-3 text-ui-label text-muted-foreground">Order ID</th>
                <th className="text-right px-4 py-3 text-ui-label text-muted-foreground">Advance Req.</th>
                <th className="text-right px-4 py-3 text-ui-label text-muted-foreground">Advance Paid</th>
                <th className="text-right px-4 py-3 text-ui-label text-muted-foreground">Final Value</th>
                <th className="text-right px-4 py-3 text-ui-label text-muted-foreground">Due Balance</th>
                <th className="text-right px-4 py-3 text-ui-label text-muted-foreground">Action</th>
              </tr>
            </thead>
            <tbody>
              {orders.map((order) => {
                const due = (order.sales_order_value ?? 0) - (order.advance_paid ?? 0);
                const actions = getAvailableActions(order);
                return (
                  <tr key={order.id} className="border-t border-border">
                    <td className="px-4 py-3 text-ui-cell text-foreground">{order.company?.business_name ?? "Unknown"}</td>
                    <td className="px-4 py-3 text-ui-cell text-muted-foreground">{order.id.slice(0, 8)}…</td>
                    <td className="px-4 py-3 text-right text-ui-kpi text-sm text-muted-foreground">{fmt(order.advance_required)}</td>
                    <td className="px-4 py-3 text-right text-ui-kpi text-sm" style={{ color: "#10b981" }}>{fmt(order.advance_paid)}</td>
                    <td className="px-4 py-3 text-right text-ui-kpi text-sm text-foreground">{fmt(order.sales_order_value)}</td>
                    <td className="px-4 py-3 text-right text-ui-kpi text-sm" style={{ color: "#c6a769" }}>{fmt(due)}</td>
                    <td className="px-4 py-3 text-right">
                      {actions.length > 0 ? (
                        <div className="relative inline-block">
                          <button
                            onClick={() => setOpenDropdown(openDropdown === order.id ? null : order.id)}
                            disabled={acting === order.id}
                            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-ui-button bg-primary/10 text-primary hover:bg-primary/20 transition-colors disabled:opacity-50"
                          >
                            {acting === order.id ? <Loader2 size={14} className="animate-spin" /> : <ChevronDown size={14} />}
                            Actions
                          </button>
                          {openDropdown === order.id && (
                            <div className="absolute right-0 top-full mt-1 w-52 bg-white rounded-xl shadow-card border border-border py-1 z-50">
                              {actions.map((a) => (
                                <button
                                  key={a}
                                  onClick={() => handleAction(order, a)}
                                  className="w-full text-left px-4 py-2.5 text-sm font-ui text-foreground hover:bg-muted transition-colors"
                                >
                                  {ACTION_LABELS[a]}
                                </button>
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

export default AdminFinance;
