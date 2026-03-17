import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Loader2, CheckCircle2 } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";

interface FinanceOrder {
  id: string;
  sales_order_value: number | null;
  advance_paid: number | null;
  advance_required: number | null;
  company_id: string | null;
  company?: { business_name: string } | null;
}

const AdminFinance = () => {
  const [orders, setOrders] = useState<FinanceOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [marking, setMarking] = useState<string | null>(null);
  const { user } = useAuth();

  const fetchOrders = async () => {
    setLoading(true);
    const { data } = await supabase
      .from("orders")
      .select("id, sales_order_value, advance_paid, advance_required, company_id, company:companies(business_name)")
      .eq("status", "dispatched")
      .order("created_at", { ascending: false });

    setOrders((data as unknown as FinanceOrder[]) ?? []);
    setLoading(false);
  };

  useEffect(() => { fetchOrders(); }, []);

  const handleMarkPaid = async (order: FinanceOrder) => {
    const due = (order.sales_order_value ?? 0) - (order.advance_paid ?? 0);
    setMarking(order.id);

    // Step 1: Insert payment record
    const { error: payErr } = await supabase.from("order_payments").insert({
      order_id: order.id,
      company_id: order.company_id,
      payment_type: "balance",
      amount: due,
      created_by: user?.id ?? null,
    });

    if (payErr) {
      toast.error("Failed to record payment: " + payErr.message);
      setMarking(null);
      return;
    }

    // Step 2: Update order status
    const { error: ordErr } = await supabase
      .from("orders")
      .update({ payment_status: "paid", closed_at: new Date().toISOString() })
      .eq("id", order.id);

    if (ordErr) {
      toast.error("Payment recorded but failed to close order");
    } else {
      toast.success("Order marked as fully paid");
      fetchOrders();
    }
    setMarking(null);
  };

  const fmt = (n: number | null) => `₹${(n ?? 0).toLocaleString("en-IN")}`;

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 size={24} className="animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <h1 className="text-display-h2 text-primary">Payment Reconciliation</h1>

      {orders.length === 0 ? (
        <p className="text-ui-label text-[#888]">No dispatched orders pending payment.</p>
      ) : (
        <div className="rounded-xl overflow-hidden border" style={{ borderColor: "#2a2a2a" }}>
          <table className="w-full">
            <thead>
              <tr style={{ backgroundColor: "#1a1a1a" }}>
                <th className="text-left px-4 py-3 text-ui-label text-[#888]">Company</th>
                <th className="text-left px-4 py-3 text-ui-label text-[#888]">Order ID</th>
                <th className="text-right px-4 py-3 text-ui-label text-[#888]">Advance Required</th>
                <th className="text-right px-4 py-3 text-ui-label text-[#888]">Advance Paid</th>
                <th className="text-right px-4 py-3 text-ui-label text-[#888]">Final Value</th>
                <th className="text-right px-4 py-3 text-ui-label text-[#888]">Due Balance</th>
                <th className="text-right px-4 py-3 text-ui-label text-[#888]">Action</th>
              </tr>
            </thead>
            <tbody>
              {orders.map((order) => {
                const due = (order.sales_order_value ?? 0) - (order.advance_paid ?? 0);
                return (
                  <tr key={order.id} className="border-t" style={{ borderColor: "#2a2a2a" }}>
                    <td className="px-4 py-3 text-ui-cell text-white">
                      {order.company?.business_name ?? "Unknown"}
                    </td>
                    <td className="px-4 py-3 text-ui-cell text-[#aaa]">
                      {order.id.slice(0, 8)}…
                    </td>
                    <td className="px-4 py-3 text-right text-ui-kpi text-sm text-[#aaa]">
                      {fmt(order.advance_required)}
                    </td>
                    <td className="px-4 py-3 text-right text-ui-kpi text-sm text-emerald-400">
                      {fmt(order.advance_paid)}
                    </td>
                    <td className="px-4 py-3 text-right text-ui-kpi text-sm text-white">
                      {fmt(order.sales_order_value)}
                    </td>
                    <td className="px-4 py-3 text-right text-ui-kpi text-sm text-amber-400">
                      {fmt(due)}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <button
                        onClick={() => handleMarkPaid(order)}
                        disabled={marking === order.id}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-ui-button bg-emerald-500/20 text-emerald-400 hover:bg-emerald-500/30 transition-colors disabled:opacity-50"
                      >
                        {marking === order.id ? (
                          <Loader2 size={14} className="animate-spin" />
                        ) : (
                          <CheckCircle2 size={14} />
                        )}
                        Mark Fully Paid
                      </button>
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
