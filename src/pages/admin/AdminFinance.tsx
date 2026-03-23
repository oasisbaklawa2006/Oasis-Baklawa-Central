import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import {
  Loader2,
  CheckCircle2,
  AlertTriangle,
  FileText,
  Search,
  ShieldCheck,
  ShieldAlert,
  Truck,
  Receipt,
  Wallet,
  Banknote,
  Ban,
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

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

type FinanceQueue = "validation" | "approvals" | "dispatch_hold" | "invoicing" | "risk_panel";

const AdminFinance = () => {
  const [orders, setOrders] = useState<FinanceOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [acting, setActing] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [activeQueue, setActiveQueue] = useState<FinanceQueue>("validation");

  const fetchOrders = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("orders")
      .select("id, status, payment_status, sales_order_value, created_at, company_id, company:companies(business_name)")
      .order("created_at", { ascending: false });

    if (!error && data) setOrders(data as unknown as FinanceOrder[]);
    setLoading(false);
  };

  useEffect(() => {
    fetchOrders();
  }, []);

  // 1. Payment Validation Action (UTR Matching)
  const handleValidatePayment = async (orderId: string) => {
    setActing(orderId);
    try {
      await supabase
        .from("orders")
        .update({ payment_status: "verified_advance", status: "in_production" })
        .eq("id", orderId);
      toast.success("Payment Validated. Cleared for Production.");
      fetchOrders();
    } catch (err) {
      toast.error("Action failed.");
    }
    setActing(null);
  };

  // 2. Commercial Approval Action (Credit)
  const handleApproveCredit = async (orderId: string) => {
    setActing(orderId);
    try {
      await supabase
        .from("orders")
        .update({ payment_status: "credit_approved", status: "in_production" })
        .eq("id", orderId);
      toast.success("Credit Risk Approved. Cleared for Production.");
      fetchOrders();
    } catch (err) {
      toast.error("Action failed.");
    }
    setActing(null);
  };

  // 3. Pre-Dispatch Clearance (The Final Gate)
  const handleReleaseDispatch = async (orderId: string) => {
    setActing(orderId);
    try {
      await supabase.from("orders").update({ status: "cleared_for_dispatch" }).eq("id", orderId);
      toast.success("Financial Block Lifted. Operations can now dispatch.");
      fetchOrders();
    } catch (err) {
      toast.error("Action failed.");
    }
    setActing(null);
  };

  // Derived Queues based on your exact logic
  const validationQueue = orders.filter((o) => o.payment_status === "awaiting_utr");
  const approvalQueue = orders.filter(
    (o) => o.payment_status === "credit_requested" || (o.status === "submitted" && o.payment_status !== "awaiting_utr"),
  );
  const dispatchHoldQueue = orders.filter((o) => o.status === "in_production"); // Assume kitchen marked ready, awaiting finance release

  // KPIs
  const totalValueToday = orders.reduce((sum, o) => sum + (o.sales_order_value || 0), 0);

  if (loading)
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh]">
        <Loader2 size={32} className="animate-spin text-[#B8860B]" />
      </div>
    );

  return (
    <div className="bg-slate-50 min-h-screen pb-12">
      {/* SECTION 1: HEADER & SNAPSHOT */}
      <div className="bg-slate-900 text-white pt-8 pb-16 px-6">
        <div className="max-w-7xl mx-auto">
          <div className="flex justify-between items-end mb-8">
            <div>
              <h1 className="font-display text-3xl font-bold">Finance Control Tower</h1>
              <p className="text-sm text-slate-400 mt-1">Approval, risk, and payment validation.</p>
            </div>
            <div className="text-right">
              <p className="text-xs text-slate-400 uppercase tracking-widest font-bold">Total Exposure (Active)</p>
              <p className="text-2xl font-black text-[#B8860B]">{formatPrice(totalValueToday)}</p>
            </div>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="bg-slate-800/50 border border-slate-700 p-4 rounded-2xl">
              <Banknote size={20} className="text-emerald-400 mb-2" />
              <p className="text-xs text-slate-400 uppercase font-bold mb-1">To Validate</p>
              <p className="text-xl font-bold">
                {validationQueue.length} <span className="text-sm text-slate-500 font-normal">UTRs</span>
              </p>
            </div>
            <div className="bg-slate-800/50 border border-slate-700 p-4 rounded-2xl">
              <ShieldAlert size={20} className="text-amber-400 mb-2" />
              <p className="text-xs text-slate-400 uppercase font-bold mb-1">Credit Approvals</p>
              <p className="text-xl font-bold">
                {approvalQueue.length} <span className="text-sm text-slate-500 font-normal">Pending</span>
              </p>
            </div>
            <div className="bg-slate-800/50 border border-slate-700 p-4 rounded-2xl">
              <Ban size={20} className="text-red-400 mb-2" />
              <p className="text-xs text-slate-400 uppercase font-bold mb-1">Dispatch Holds</p>
              <p className="text-xl font-bold">
                {dispatchHoldQueue.length} <span className="text-sm text-slate-500 font-normal">Blocked</span>
              </p>
            </div>
            <div className="bg-slate-800/50 border border-slate-700 p-4 rounded-2xl">
              <Receipt size={20} className="text-blue-400 mb-2" />
              <p className="text-xs text-slate-400 uppercase font-bold mb-1">Pending Invoices</p>
              <p className="text-xl font-bold">
                0 <span className="text-sm text-slate-500 font-normal">Drafts</span>
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* QUEUE NAVIGATION */}
      <div className="max-w-7xl mx-auto px-6 -mt-6">
        <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-2 flex overflow-x-auto scrollbar-hide gap-2">
          {[
            { id: "validation", label: "Payment Validation", count: validationQueue.length, icon: Banknote },
            { id: "approvals", label: "Commercial Approvals", count: approvalQueue.length, icon: ShieldCheck },
            { id: "dispatch_hold", label: "Dispatch Clearance", count: dispatchHoldQueue.length, icon: Truck },
            { id: "invoicing", label: "Invoice Control", count: 0, icon: Receipt },
            { id: "risk_panel", label: "Credit Risk Panel", count: null, icon: Wallet },
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveQueue(tab.id as FinanceQueue)}
              className={`flex items-center gap-2 px-4 py-3 rounded-xl text-sm font-bold whitespace-nowrap transition-colors ${activeQueue === tab.id ? "bg-slate-900 text-white" : "text-slate-600 hover:bg-slate-100"}`}
            >
              <tab.icon size={16} className={activeQueue === tab.id ? "text-[#B8860B]" : "text-slate-400"} />
              {tab.label}
              {tab.count !== null && (
                <span
                  className={`px-2 py-0.5 rounded-full text-[10px] ${activeQueue === tab.id ? "bg-white/20 text-white" : "bg-slate-200 text-slate-700"}`}
                >
                  {tab.count}
                </span>
              )}
            </button>
          ))}
        </div>

        {/* ACTIVE QUEUE RENDERER */}
        <div className="mt-6">
          {/* QUEUE 2: PAYMENT VALIDATION */}
          {activeQueue === "validation" && (
            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
              {validationQueue.length === 0 ? (
                <p className="text-slate-500 font-bold p-4">No UTRs pending validation.</p>
              ) : (
                validationQueue.map((order) => (
                  <div key={order.id} className="bg-white border-l-4 border-amber-400 rounded-xl p-5 shadow-sm">
                    <div className="flex justify-between items-start border-b border-slate-100 pb-3 mb-3">
                      <div>
                        <p className="text-xs text-slate-400 font-bold uppercase">Order #{order.id.split("-")[0]}</p>
                        <p className="font-black text-slate-900 text-lg">{order.company?.business_name}</p>
                      </div>
                    </div>
                    <div className="flex justify-between items-center mb-5">
                      <p className="text-xl font-black text-amber-600">{formatPrice(order.sales_order_value || 0)}</p>
                      <span className="bg-amber-50 text-amber-700 px-2 py-1 rounded text-[10px] font-bold uppercase flex items-center gap-1">
                        <AlertTriangle size={12} /> UTR Uploaded
                      </span>
                    </div>
                    <div className="flex gap-2">
                      <button className="flex-1 py-2.5 border border-slate-200 text-slate-600 rounded-lg text-xs font-bold hover:bg-slate-50">
                        View UTR
                      </button>
                      <button
                        onClick={() => handleValidatePayment(order.id)}
                        disabled={acting === order.id}
                        className="flex-1 py-2.5 bg-emerald-600 text-white rounded-lg text-xs font-bold hover:bg-emerald-700 flex justify-center items-center gap-1"
                      >
                        {acting === order.id ? (
                          <Loader2 size={14} className="animate-spin" />
                        ) : (
                          <>
                            <CheckCircle2 size={14} /> Validate Payment
                          </>
                        )}
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>
          )}

          {/* QUEUE 1: COMMERCIAL APPROVALS (Credit Risk) */}
          {activeQueue === "approvals" && (
            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
              {approvalQueue.length === 0 ? (
                <p className="text-slate-500 font-bold p-4">No commercial approvals pending.</p>
              ) : (
                approvalQueue.map((order) => (
                  <div key={order.id} className="bg-white border-l-4 border-red-500 rounded-xl p-5 shadow-sm">
                    <div className="flex justify-between items-start border-b border-slate-100 pb-3 mb-3">
                      <div>
                        <p className="text-xs text-slate-400 font-bold uppercase">Order #{order.id.split("-")[0]}</p>
                        <p className="font-black text-slate-900 text-lg">{order.company?.business_name}</p>
                      </div>
                    </div>
                    <div className="flex justify-between items-center mb-5">
                      <p className="text-xl font-black text-slate-900">{formatPrice(order.sales_order_value || 0)}</p>
                      <span className="bg-red-50 text-red-700 px-2 py-1 rounded text-[10px] font-bold uppercase">
                        Risk Assessment
                      </span>
                    </div>
                    <div className="flex gap-2">
                      <button className="flex-1 py-2.5 bg-slate-100 text-slate-600 rounded-lg text-xs font-bold hover:bg-slate-200">
                        Reject
                      </button>
                      <button className="flex-1 py-2.5 bg-amber-100 text-amber-800 rounded-lg text-xs font-bold hover:bg-amber-200">
                        Hold
                      </button>
                      <button
                        onClick={() => handleApproveCredit(order.id)}
                        disabled={acting === order.id}
                        className="flex-1 py-2.5 bg-slate-900 text-[#B8860B] rounded-lg text-xs font-bold hover:bg-black"
                      >
                        Approve Credit
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>
          )}

          {/* QUEUE 3: DISPATCH CLEARANCE GATE */}
          {activeQueue === "dispatch_hold" && (
            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
              {dispatchHoldQueue.length === 0 ? (
                <p className="text-slate-500 font-bold p-4">No orders blocked at dispatch gate.</p>
              ) : (
                dispatchHoldQueue.map((order) => (
                  <div key={order.id} className="bg-white border-l-4 border-[#B8860B] rounded-xl p-5 shadow-sm">
                    <div className="flex justify-between items-start border-b border-slate-100 pb-3 mb-3">
                      <div>
                        <p className="text-xs text-slate-400 font-bold uppercase">Order #{order.id.split("-")[0]}</p>
                        <p className="font-black text-slate-900 text-lg">{order.company?.business_name}</p>
                      </div>
                    </div>
                    <div className="flex justify-between items-center mb-5">
                      <div>
                        <p className="text-[10px] text-slate-500 font-bold uppercase">Amount Pending</p>
                        <p className="text-xl font-black text-slate-900">{formatPrice(order.sales_order_value || 0)}</p>
                      </div>
                      <span className="bg-slate-100 text-slate-600 px-2 py-1 rounded text-[10px] font-bold uppercase flex items-center gap-1">
                        <Ban size={12} /> Dispatch Held
                      </span>
                    </div>
                    <div className="flex gap-2">
                      <button className="flex-1 py-2.5 border border-slate-200 text-slate-600 rounded-lg text-xs font-bold hover:bg-slate-50">
                        View Invoice
                      </button>
                      <button
                        onClick={() => handleReleaseDispatch(order.id)}
                        disabled={acting === order.id}
                        className="flex-[2] py-2.5 bg-emerald-600 text-white rounded-lg text-xs font-bold hover:bg-emerald-700 flex justify-center items-center gap-1"
                      >
                        {acting === order.id ? (
                          <Loader2 size={14} className="animate-spin" />
                        ) : (
                          <>
                            <Truck size={14} /> Release Dispatch
                          </>
                        )}
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>
          )}

          {/* QUEUE 4: INVOICE CONTROL (Framework) */}
          {activeQueue === "invoicing" && (
            <div className="bg-white rounded-2xl border border-slate-200 p-12 text-center shadow-sm">
              <Receipt size={48} className="mx-auto text-slate-300 mb-4" />
              <h3 className="font-display text-xl font-bold text-slate-900">Invoice Control Center</h3>
              <p className="text-slate-500 text-sm mt-1 max-w-md mx-auto">
                Create, modify, apply taxes, and lock final invoices before dispatch clearance.
              </p>
              <button className="mt-6 px-6 py-2 bg-slate-100 text-slate-500 rounded-lg text-sm font-bold cursor-not-allowed">
                Pending Database Table
              </button>
            </div>
          )}

          {/* SECTION 4: CREDIT RISK PANEL (Framework) */}
          {activeQueue === "risk_panel" && (
            <div className="bg-white rounded-2xl border border-slate-200 p-12 text-center shadow-sm">
              <Wallet size={48} className="mx-auto text-slate-300 mb-4" />
              <h3 className="font-display text-xl font-bold text-slate-900">Customer Credit Risk</h3>
              <p className="text-slate-500 text-sm mt-1 max-w-md mx-auto">
                Manage credit limits, view outstanding exposure, and block risky accounts.
              </p>
              <button className="mt-6 px-6 py-2 bg-slate-100 text-slate-500 rounded-lg text-sm font-bold cursor-not-allowed">
                Pending Database Table
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default AdminFinance;
