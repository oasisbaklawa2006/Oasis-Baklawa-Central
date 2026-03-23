import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import {
  Loader2,
  CheckCircle2,
  AlertTriangle,
  FileText,
  Search,
  Clock,
  Eye,
  Truck,
  BarChart3,
  Wallet,
  Users,
  X,
  ShieldAlert,
} from "lucide-react";
import { AnimatePresence, motion } from "framer-motion";

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
  const [activeTab, setActiveTab] = useState<"verify" | "dispatch" | "reports">("verify");

  // Modals
  const [viewUtrOrder, setViewUtrOrder] = useState<string | null>(null);
  const [overrideOrder, setOverrideOrder] = useState<string | null>(null);
  const [overrideReason, setOverrideReason] = useState("");

  const fetchOrders = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("orders")
      .select("id, status, payment_status, sales_order_value, created_at, company_id, company:companies(business_name)")
      .in("status", ["submitted", "in_production", "dispatched"])
      .order("created_at", { ascending: false });

    if (error) toast.error("Failed to fetch finance queue.");
    else setOrders((data as unknown as FinanceOrder[]) ?? []);

    setLoading(false);
  };

  useEffect(() => {
    fetchOrders();
  }, []);

  // 1. Standard Approval
  const handleVerifyAndApprove = async (orderId: string) => {
    setActing(orderId);
    try {
      const { error } = await supabase
        .from("orders")
        .update({
          payment_status: "verified_advance",
          status: "in_production",
        })
        .eq("id", orderId);
      if (error) throw error;
      toast.success("Payment Verified! Order sent to Kitchen.", { icon: "🔥" });
      fetchOrders();
    } catch (err) {
      toast.error("Action failed.");
    }
    setActing(null);
  };

  // 2. Override Approval (Without Payment)
  const handleOverride = async () => {
    if (!overrideOrder || !overrideReason.trim()) {
      toast.error("A reason is legally required for overrides.");
      return;
    }
    setActing(overrideOrder);
    try {
      // Note: In the future, we will save overrideReason to an 'audit_logs' or 'notes' table
      const { error } = await supabase
        .from("orders")
        .update({
          payment_status: "credit_override",
          status: "in_production",
        })
        .eq("id", overrideOrder);
      if (error) throw error;

      toast.success("Order overridden and pushed to production.");
      setOverrideOrder(null);
      setOverrideReason("");
      fetchOrders();
    } catch (err) {
      toast.error("Override failed.");
    }
    setActing(null);
  };

  // 3. Final Dispatch
  const handleDispatch = async (orderId: string) => {
    setActing(orderId);
    try {
      const { error } = await supabase
        .from("orders")
        .update({
          status: "dispatched",
        })
        .eq("id", orderId);
      if (error) throw error;
      toast.success("Order marked as Dispatched! 🚚");
      fetchOrders();
    } catch (err) {
      toast.error("Dispatch failed.");
    }
    setActing(null);
  };

  const pendingOrders = orders.filter((o) => o.status === "submitted");
  const productionOrders = orders.filter((o) => o.status === "in_production");

  if (loading)
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh]">
        <Loader2 size={32} className="animate-spin text-[#B8860B]" />
        <p className="mt-4 text-slate-500 font-bold">Loading ERP...</p>
      </div>
    );

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-12 px-2 md:px-6">
      {/* HEADER */}
      <div className="pt-6 pb-2">
        <h1 className="font-display text-3xl font-bold text-slate-900">ERP Command Center</h1>
        <p className="text-sm font-bold text-slate-500 mt-1">Manage finances, dispatch, and company ledgers.</p>
      </div>

      {/* TOP TABS */}
      <div className="flex overflow-x-auto gap-2 border-b border-slate-200 pb-px scrollbar-hide">
        <button
          onClick={() => setActiveTab("verify")}
          className={`px-5 py-3 text-sm font-bold whitespace-nowrap border-b-2 transition-colors ${activeTab === "verify" ? "border-[#B8860B] text-[#B8860B]" : "border-transparent text-slate-500 hover:text-slate-800"}`}
        >
          1. Verify Payments ({pendingOrders.length})
        </button>
        <button
          onClick={() => setActiveTab("dispatch")}
          className={`px-5 py-3 text-sm font-bold whitespace-nowrap border-b-2 transition-colors ${activeTab === "dispatch" ? "border-[#B8860B] text-[#B8860B]" : "border-transparent text-slate-500 hover:text-slate-800"}`}
        >
          2. Kitchen & Dispatch ({productionOrders.length})
        </button>
        <button
          onClick={() => setActiveTab("reports")}
          className={`px-5 py-3 text-sm font-bold whitespace-nowrap border-b-2 transition-colors ${activeTab === "reports" ? "border-[#B8860B] text-[#B8860B]" : "border-transparent text-slate-500 hover:text-slate-800"}`}
        >
          3. Ledgers & Reports
        </button>
      </div>

      {/* TAB 1: VERIFY PAYMENTS */}
      {activeTab === "verify" && (
        <div className="space-y-4">
          <div className="relative bg-white rounded-2xl shadow-sm border border-slate-200 p-2 flex items-center">
            <Search size={18} className="text-slate-400 ml-3" />
            <input
              type="text"
              placeholder="Search pending orders..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full bg-transparent border-none focus:ring-0 text-sm font-bold px-3 py-2 outline-none"
            />
          </div>

          {pendingOrders.length === 0 ? (
            <div className="bg-white rounded-3xl border border-slate-200 p-12 text-center shadow-sm">
              <CheckCircle2 size={48} className="mx-auto text-emerald-400 mb-4" />
              <h3 className="font-display text-xl font-bold text-slate-900">Queue Clear!</h3>
              <p className="text-slate-500 text-sm mt-1">No pending payments to verify.</p>
            </div>
          ) : (
            pendingOrders.map((order) => (
              <div
                key={order.id}
                className="bg-white rounded-2xl border border-amber-300 bg-amber-50/20 p-5 flex flex-col md:flex-row items-start md:items-center justify-between gap-4 shadow-sm hover:shadow-md"
              >
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-[10px] font-bold bg-slate-100 text-slate-500 px-2 py-1 rounded uppercase">
                      ID: {order.id.split("-")[0]}
                    </span>
                    <span className="text-[10px] font-bold text-slate-400">{formatDate(order.created_at)}</span>
                  </div>
                  <h3 className="text-lg font-black text-slate-900">
                    {order.company?.business_name ?? "Unknown Company"}
                  </h3>
                  <p className="text-sm font-bold text-slate-600 flex items-center gap-1.5 mt-2">
                    <FileText size={14} /> Invoice Value:{" "}
                    <span className="text-[#B8860B] font-black">{formatPrice(order.sales_order_value ?? 0)}</span>
                  </p>
                </div>

                <div className="w-full md:w-auto flex flex-col gap-2">
                  <div className="flex gap-2 w-full">
                    <button
                      onClick={() => setViewUtrOrder(order.id)}
                      className="flex-1 flex items-center justify-center gap-1.5 px-4 py-3 bg-white border border-slate-300 text-slate-700 rounded-xl text-xs font-bold hover:bg-slate-50 shadow-sm"
                    >
                      <Eye size={16} /> View UTR
                    </button>
                    <button
                      onClick={() => setOverrideOrder(order.id)}
                      className="flex-1 flex items-center justify-center gap-1.5 px-4 py-3 bg-slate-900 text-white rounded-xl text-xs font-bold hover:bg-black shadow-sm"
                    >
                      <ShieldAlert size={16} /> Override
                    </button>
                  </div>
                  <button
                    onClick={() => handleVerifyAndApprove(order.id)}
                    disabled={acting === order.id}
                    className="w-full flex items-center justify-center gap-2 px-6 py-3 bg-[#B8860B] text-white rounded-xl text-sm font-bold hover:bg-[#9A7009] active:scale-95 transition-all shadow-md"
                  >
                    {acting === order.id ? (
                      <Loader2 size={16} className="animate-spin" />
                    ) : (
                      <>
                        <CheckCircle2 size={18} /> Verify & Push to Kitchen
                      </>
                    )}
                  </button>
                </div>
              </div>
            ))
          )}
        </div>
      )}

      {/* TAB 2: KITCHEN & DISPATCH */}
      {activeTab === "dispatch" && (
        <div className="space-y-4">
          {productionOrders.length === 0 ? (
            <div className="bg-white rounded-3xl border border-slate-200 p-12 text-center shadow-sm">
              <Truck size={48} className="mx-auto text-slate-300 mb-4" />
              <h3 className="font-display text-xl font-bold text-slate-900">Kitchen is Empty</h3>
              <p className="text-slate-500 text-sm mt-1">No verified orders awaiting dispatch.</p>
            </div>
          ) : (
            productionOrders.map((order) => (
              <div
                key={order.id}
                className="bg-white rounded-2xl border border-slate-200 p-5 flex flex-col md:flex-row items-start md:items-center justify-between gap-4 shadow-sm"
              >
                <div>
                  <h3 className="text-lg font-black text-slate-900">
                    {order.company?.business_name ?? "Unknown Company"}
                  </h3>
                  <p className="text-sm font-bold text-slate-500 mt-1">Order ID: {order.id.split("-")[0]}</p>
                  <span className="inline-block mt-3 text-[10px] font-bold bg-emerald-100 text-emerald-700 px-3 py-1 rounded-full uppercase tracking-widest border border-emerald-200">
                    Baking & Packing
                  </span>
                </div>
                <button
                  onClick={() => handleDispatch(order.id)}
                  disabled={acting === order.id}
                  className="w-full md:w-auto px-8 py-4 bg-slate-900 text-white rounded-xl text-sm font-bold hover:bg-black active:scale-95 transition-all shadow-lg flex justify-center items-center gap-2"
                >
                  {acting === order.id ? (
                    <Loader2 size={18} className="animate-spin" />
                  ) : (
                    <>
                      <Truck size={18} /> Mark as Dispatched
                    </>
                  )}
                </button>
              </div>
            ))
          )}
        </div>
      )}

      {/* TAB 3: LEDGERS & REPORTS (UI Mockup) */}
      {activeTab === "reports" && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm">
            <div className="flex items-center gap-3 mb-6">
              <div className="p-3 bg-blue-50 text-blue-600 rounded-xl">
                <Users size={24} />
              </div>
              <div>
                <h3 className="font-bold text-slate-900">Party-Wise Ledgers</h3>
                <p className="text-xs text-slate-500">Creditors & Debtors list</p>
              </div>
            </div>
            <div className="space-y-3 opacity-60">
              <div className="flex justify-between items-center text-sm border-b pb-2">
                <span className="font-bold">TCF Chocolates</span>
                <span className="text-red-500 font-bold">- ₹1,45,000 (Due)</span>
              </div>
              <div className="flex justify-between items-center text-sm border-b pb-2">
                <span className="font-bold">Emirates Sweets</span>
                <span className="text-emerald-500 font-bold">+ ₹20,000 (Cr)</span>
              </div>
            </div>
            <button className="w-full mt-6 py-3 bg-slate-100 text-slate-500 rounded-xl text-sm font-bold flex items-center justify-center gap-2 cursor-not-allowed">
              Database Table Pending
            </button>
          </div>

          <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm">
            <div className="flex items-center gap-3 mb-6">
              <div className="p-3 bg-purple-50 text-purple-600 rounded-xl">
                <Wallet size={24} />
              </div>
              <div>
                <h3 className="font-bold text-slate-900">Wallet Withdrawals</h3>
                <p className="text-xs text-slate-500">Pending customer refund requests</p>
              </div>
            </div>
            <div className="space-y-3 opacity-60">
              <div className="flex justify-between items-center text-sm border-b pb-2">
                <span className="font-bold">Delhi Distributors</span>
                <span className="font-bold">Req: ₹5,000</span>
              </div>
            </div>
            <button className="w-full mt-6 py-3 bg-slate-100 text-slate-500 rounded-xl text-sm font-bold flex items-center justify-center gap-2 cursor-not-allowed">
              Database Table Pending
            </button>
          </div>

          <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm md:col-span-2">
            <div className="flex items-center gap-3 mb-6">
              <div className="p-3 bg-emerald-50 text-emerald-600 rounded-xl">
                <BarChart3 size={24} />
              </div>
              <div>
                <h3 className="font-bold text-slate-900">Financial Insights</h3>
                <p className="text-xs text-slate-500">Credit vs Total, Timely vs Untimely</p>
              </div>
            </div>
            <div className="h-40 bg-slate-50 rounded-xl border border-slate-100 flex items-center justify-center border-dashed">
              <p className="text-slate-400 font-bold text-sm">Graph UI Loading... (Requires Transaction Data)</p>
            </div>
          </div>
        </div>
      )}

      {/* MODALS */}
      <AnimatePresence>
        {/* UTR Modal */}
        {viewUtrOrder && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              className="bg-white rounded-2xl p-6 w-full max-w-sm"
            >
              <div className="flex justify-between items-center mb-4">
                <h3 className="font-bold text-lg">Bank Transfer Receipt</h3>
                <button onClick={() => setViewUtrOrder(null)}>
                  <X size={20} className="text-slate-500" />
                </button>
              </div>
              <div className="aspect-[3/4] bg-slate-100 rounded-xl border border-slate-200 flex flex-col items-center justify-center text-center p-6">
                <FileText size={48} className="text-slate-300 mb-3" />
                <p className="text-sm font-bold text-slate-600">No image uploaded.</p>
                <p className="text-xs text-slate-400 mt-1">The buyer hasn't attached a UTR screenshot yet.</p>
              </div>
            </motion.div>
          </div>
        )}

        {/* Override Modal */}
        {overrideOrder && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              className="bg-white rounded-2xl p-6 w-full max-w-md"
            >
              <h3 className="font-bold text-xl text-red-600 flex items-center gap-2 mb-2">
                <ShieldAlert size={20} /> Approve Without Payment
              </h3>
              <p className="text-sm text-slate-600 mb-4">
                You are clearing this order for production on credit. Please log the reason for accounts.
              </p>
              <textarea
                value={overrideReason}
                onChange={(e) => setOverrideReason(e.target.value)}
                placeholder="e.g., Authorized by Management, Pre-approved corporate ledger..."
                className="w-full border border-slate-200 rounded-xl p-3 text-sm focus:ring-2 focus:ring-red-500 outline-none min-h-[100px]"
              />
              <div className="flex gap-3 mt-4">
                <button
                  onClick={() => setOverrideOrder(null)}
                  className="flex-1 py-3 bg-slate-100 text-slate-600 font-bold rounded-xl"
                >
                  Cancel
                </button>
                <button
                  onClick={handleOverride}
                  disabled={acting === overrideOrder}
                  className="flex-1 py-3 bg-red-600 text-white font-bold rounded-xl flex justify-center items-center"
                >
                  {acting === overrideOrder ? <Loader2 size={16} className="animate-spin" /> : "Force Approve"}
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default AdminFinance;
