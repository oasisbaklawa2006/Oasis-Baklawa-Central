import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { motion } from "framer-motion";
import { toast } from "sonner";
import { CheckCircle2, Loader2, IndianRupee, Clock, AlertCircle } from "lucide-react";
import TopNavBar from "@/components/TopNavBar";

// --- THE MISSING DEFINITIONS THE COMPILER WAS LOOKING FOR ---
const STATUSES = [
  "draft",
  "submitted",
  "under_review",
  "awaiting_advance",
  "approved",
  "in_production",
  "assembly",
  "packing",
  "ready_for_dispatch",
  "dispatched",
  "in_transit",
  "delivered",
  "complaint_window",
  "closed",
  "cancelled",
] as const;

interface OrderCard {
  id: string;
  status: string;
  sales_order_value: number | null;
  company_id: string | null;
  created_at?: string;
  companies?: any;
  company?: any;
}
// ------------------------------------------------------------

const AdminAccountsRelease = () => {
  const [orders, setOrders] = useState<OrderCard[]>([]);
  const [loading, setLoading] = useState(true);
  const [updating, setUpdating] = useState<string | null>(null);

  const fetchFinanceOrders = async () => {
    setLoading(true);

    // Fetch orders that need financial clearance
    const { data, error } = await supabase
      .from("orders")
      .select(
        `
        id, status, sales_order_value, company_id, created_at,
        companies ( business_name )
      `,
      )
      .in("status", ["submitted", "under_review", "awaiting_advance"])
      .order("created_at", { ascending: false });

    if (error) {
      console.error("Database Error:", error);
      toast.error("Failed to load finance data");
    } else {
      setOrders((data as any[]) || []);
    }
    setLoading(false);
  };

  useEffect(() => {
    fetchFinanceOrders();
  }, []);

  const handleApprove = async (orderId: string) => {
    setUpdating(orderId);

    // Move order straight to approved so production can start
    const { error } = await supabase.from("orders").update({ status: "approved" }).eq("id", orderId);

    if (error) {
      toast.error("Failed to approve order");
    } else {
      toast.success("Order Financially Cleared & Approved!");
      await fetchFinanceOrders();
    }
    setUpdating(null);
  };

  const getCompanyName = (order: OrderCard) => {
    if (order.company?.business_name) return order.company.business_name;
    if (order.companies?.business_name) return order.companies.business_name;
    if (Array.isArray(order.companies) && order.companies[0]?.business_name) return order.companies[0].business_name;
    return "Unknown Company";
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-background">
        <Loader2 size={32} className="animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background pb-20">
      <TopNavBar />

      <main className="pt-24 px-5 max-w-5xl mx-auto space-y-8">
        {/* Header */}
        <div className="border-b border-border pb-6">
          <div className="flex items-center gap-2 text-emerald-600 mb-2">
            <IndianRupee size={20} />
            <span className="font-bold text-sm tracking-widest uppercase">Accounts & Finance</span>
          </div>
          <h1 className="text-display-h1 text-foreground">Pending Clearances</h1>
          <p className="text-body-p2 text-muted-foreground mt-1">Review order values and clear them for production.</p>
        </div>

        {orders.length === 0 ? (
          <div className="text-center py-20 bg-muted/10 rounded-[2rem] border border-dashed border-border">
            <CheckCircle2 size={48} className="mx-auto text-emerald-500/50 mb-4" />
            <h3 className="text-lg font-bold text-foreground">All Clear!</h3>
            <p className="text-sm text-muted-foreground mt-1">
              No orders are currently waiting for financial approval.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {orders.map((order) => (
              <motion.div
                key={order.id}
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                className="bg-card rounded-[2rem] border border-border p-5 shadow-sm hover:shadow-md transition-all flex flex-col"
              >
                <div className="flex justify-between items-start mb-4">
                  <div>
                    <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider mb-1">Client</p>
                    <p className="font-bold text-foreground line-clamp-1">{getCompanyName(order)}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider mb-1">
                      Order ID
                    </p>
                    <p className="font-mono text-xs font-bold text-muted-foreground">
                      #{order.id.slice(0, 6).toUpperCase()}
                    </p>
                  </div>
                </div>

                <div className="bg-muted/30 rounded-xl p-4 mb-4 flex items-center justify-between border border-border/50">
                  <div className="flex items-center gap-2">
                    <IndianRupee size={16} className="text-foreground" />
                    <span className="text-xs font-bold text-muted-foreground uppercase">Value</span>
                  </div>
                  <p className="font-display text-lg text-foreground">
                    ₹{(order.sales_order_value ?? 0).toLocaleString("en-IN")}
                  </p>
                </div>

                <div className="mt-auto">
                  <button
                    onClick={() => handleApprove(order.id)}
                    disabled={updating === order.id}
                    className="w-full flex items-center justify-center gap-2 py-3 rounded-xl font-bold text-sm bg-emerald-50 text-emerald-700 hover:bg-emerald-600 hover:text-white border border-emerald-200 hover:border-emerald-600 transition-all disabled:opacity-50"
                  >
                    {updating === order.id ? (
                      <Loader2 size={16} className="animate-spin" />
                    ) : (
                      <>
                        <CheckCircle2 size={16} />
                        Clear & Approve
                      </>
                    )}
                  </button>
                </div>
              </motion.div>
            ))}
          </div>
        )}
      </main>
    </div>
  );
};

export default AdminAccountsRelease;
