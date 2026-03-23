import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Loader2, CheckCircle2, AlertTriangle, FileText, Search, Clock, ArrowRight, Eye } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";

interface FinanceOrder {
  id: string;
  status: string;
  payment_status: string | null;
  sales_order_value: number | null;
  created_at: string;
  company_id: string | null;
  company?: { business_name: string } | null;
}

const formatPrice = (n: number) => "₹" + n.toLocaleString("en-IN");
const formatDate = (dateString: string) =>
  new Date(dateString).toLocaleDateString("en-IN", {
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });

const AdminFinance = () => {
  const [orders, setOrders] = useState<FinanceOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [acting, setActing] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const { user } = useAuth();

  const fetchOrders = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("orders")
      .select("id, status, payment_status, sales_order_value, created_at, company_id, company:companies(business_name)")
      .in("status", ["submitted", "in_production"]) // Only show relevant active orders
      .order("created_at", { ascending: false });

    if (error) {
      toast.error("Failed to fetch finance queue.");
      console.error(error);
    } else {
      setOrders((data as unknown as FinanceOrder[]) ?? []);
    }
    setLoading(false);
  };

  useEffect(() => {
    fetchOrders();
  }, []);

  // The Magic "Approve" Button Logic
  const handleVerifyAndApprove = async (orderId: string) => {
    setActing(orderId);
    try {
      // 1. Mark payment as verified, 2. Send straight to the Kitchen!
      const { error } = await supabase
        .from("orders")
        .update({
          payment_status: "verified_advance",
          status: "in_production",
        })
        .eq("id", orderId);

      if (error) throw error;

      toast.success("Payment Verified! Order sent to Kitchen for Production.", { icon: "🔥" });
      fetchOrders();
    } catch (err) {
      toast.error("Action failed. Check database connection.");
    }
    setActing(null);
  };

  const filteredOrders = orders.filter(
    (o) =>
      o.id.toLowerCase().includes(search.toLowerCase()) ||
      (o.company?.business_name || "").toLowerCase().includes(search.toLowerCase()),
  );

  const pendingCount = orders.filter((o) => o.payment_status === "awaiting_utr").length;

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh]">
        <Loader2 size={32} className="animate-spin text-[#B8860B]" />
        <p className="mt-4 text-slate-500 font-bold">Loading Accounts...</p>
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-6xl mx-auto pb-12">
      {/* HEADER & KPIS */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 mb-8">
        <div>
          <h1 className="font-display text-3xl font-bold text-slate-900">Finance Command Center</h1>
          <p className="text-sm font-bold text-slate-500 mt-1">Verify settlements and clear orders for production.</p>
        </div>
        <div className="flex gap-3">
          <div className="bg-amber-50 border border-amber-200 px-4 py-3 rounded-2xl flex items-center gap-3">
            <div className="bg-amber-100 p-2 rounded-xl text-amber-600">
              <Clock size={20} />
            </div>
            <div>
              <p className="text-[10px] uppercase tracking-widest font-bold text-amber-700">Awaiting Verification</p>
              <p className="text-xl font-black text-amber-900">{pendingCount} Orders</p>
            </div>
          </div>
        </div>
      </div>

      {/* SEARCH BAR */}
      <div className="relative bg-white rounded-2xl shadow-sm border border-slate-200 p-2 flex items-center">
        <Search size={18} className="text-slate-400 ml-3" />
        <input
          type="text"
          placeholder="Search by Company Name or Order ID..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full bg-transparent border-none focus:ring-0 text-sm font-bold px-3 py-2 text-slate-900 outline-none"
        />
      </div>

      {/* THE FINANCE QUEUE */}
      {filteredOrders.length === 0 ? (
        <div className="bg-white rounded-3xl border border-slate-200 p-12 text-center shadow-sm">
          <CheckCircle2 size={48} className="mx-auto text-emerald-400 mb-4" />
          <h3 className="font-display text-xl font-bold text-slate-900">All Caught Up!</h3>
          <p className="text-slate-500 text-sm mt-1">No pending payments require verification right now.</p>
        </div>
      ) : (
        <div className="grid gap-4">
          {filteredOrders.map((order) => {
            const isPending = order.payment_status === "awaiting_utr";
            const isCleared = order.status === "in_production";
            const total = order.sales_order_value ?? 0;

            return (
              <div
                key={order.id}
                className={`bg-white rounded-2xl border p-5 flex flex-col md:flex-row items-start md:items-center justify-between gap-4 transition-all shadow-sm hover:shadow-md ${isPending ? "border-amber-300 bg-amber-50/30" : "border-slate-200"}`}
              >
                {/* Order Details */}
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-[10px] font-bold bg-slate-100 text-slate-500 px-2 py-1 rounded uppercase tracking-wider">
                      ID: {order.id.split("-")[0]}
                    </span>
                    <span className="text-[10px] font-bold text-slate-400">{formatDate(order.created_at)}</span>
                  </div>
                  <h3 className="text-lg font-black text-slate-900">
                    {order.company?.business_name ?? "Unknown Company"}
                  </h3>
                  <div className="flex items-center gap-4 mt-2">
                    <p className="text-sm font-bold text-slate-600 flex items-center gap-1.5">
                      <FileText size={14} /> Invoice Value:{" "}
                      <span className="text-[#B8860B] font-black">{formatPrice(total)}</span>
                    </p>
                  </div>
                </div>

                {/* Status Badge */}
                <div className="w-full md:w-auto flex flex-col items-end gap-3">
                  {isPending && (
                    <span className="inline-flex items-center gap-1.5 bg-amber-100 text-amber-800 px-3 py-1.5 rounded-lg text-xs font-bold uppercase tracking-wider border border-amber-200">
                      <AlertTriangle size={14} /> UTR Uploaded
                    </span>
                  )}
                  {isCleared && (
                    <span className="inline-flex items-center gap-1.5 bg-emerald-100 text-emerald-800 px-3 py-1.5 rounded-lg text-xs font-bold uppercase tracking-wider border border-emerald-200">
                      <CheckCircle2 size={14} /> Cleared for Kitchen
                    </span>
                  )}

                  {/* Action Buttons */}
                  <div className="flex gap-2 w-full md:w-auto">
                    {/* View UTR Button (Mockup for now) */}
                    <button
                      onClick={() => toast.info("Opening Receipt Viewer...")}
                      className="flex-1 md:flex-none flex items-center justify-center gap-2 px-4 py-2.5 bg-white border border-slate-200 text-slate-700 rounded-xl text-xs font-bold hover:bg-slate-50 transition-colors shadow-sm"
                    >
                      <Eye size={16} /> View UTR
                    </button>

                    {/* The Magic Approve Button */}
                    {isPending && (
                      <button
                        onClick={() => handleVerifyAndApprove(order.id)}
                        disabled={acting === order.id}
                        className="flex-1 md:flex-none flex items-center justify-center gap-2 px-6 py-2.5 bg-[#B8860B] text-white rounded-xl text-xs font-bold hover:bg-[#9A7009] active:scale-95 transition-all shadow-md disabled:opacity-70"
                      >
                        {acting === order.id ? (
                          <Loader2 size={16} className="animate-spin" />
                        ) : (
                          <>
                            <CheckCircle2 size={16} /> Verify & Push to Kitchen
                          </>
                        )}
                      </button>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default AdminFinance;
