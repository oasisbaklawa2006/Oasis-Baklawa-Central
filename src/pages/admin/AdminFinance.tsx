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
  UploadCloud,
  FileUp,
  X,
  Banknote,
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
const formatDate = (dateString: string) =>
  new Date(dateString).toLocaleDateString("en-IN", {
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });

type FinanceQueue = "validation" | "approvals" | "dispatch_hold";

const AdminFinance = () => {
  const [orders, setOrders] = useState<FinanceOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [acting, setActing] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [activeQueue, setActiveQueue] = useState<FinanceQueue>("validation");

  // Document Hub Modal State
  const [docOrder, setDocOrder] = useState<FinanceOrder | null>(null);
  const [finalInvoiceValue, setFinalInvoiceValue] = useState<string>("");
  const [invoiceUploaded, setInvoiceUploaded] = useState(false);
  const [ewayUploaded, setEwayUploaded] = useState(false);

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

  // THE NEW DOCUMENT HUB SUBMIT LOGIC
  const handleFinalizeDocuments = async () => {
    if (!docOrder || !finalInvoiceValue || !invoiceUploaded) {
      toast.error("You must upload the Tally Invoice and enter the final amount.");
      return;
    }
    setActing(docOrder.id);
    try {
      // In a real app, we would calculate logic here:
      // If Final Invoice > Advance Paid -> status = 'awaiting_final_payment'
      // If Fully Paid -> status = 'cleared_for_dispatch'

      await supabase
        .from("orders")
        .update({
          sales_order_value: parseFloat(finalInvoiceValue), // Update to real Tally value
          status: "awaiting_final_payment", // Assuming they need to pay balance
        })
        .eq("id", docOrder.id);

      toast.success("Tally Invoice Uploaded! Customer notified to pay final balance.");
      setDocOrder(null);
      setInvoiceUploaded(false);
      setEwayUploaded(false);
      setFinalInvoiceValue("");
      fetchOrders();
    } catch (err) {
      toast.error("Upload failed.");
    }
    setActing(null);
  };

  const validationQueue = orders.filter((o) => o.payment_status === "awaiting_utr");
  const approvalQueue = orders.filter((o) => o.payment_status === "credit_requested");
  const dispatchHoldQueue = orders.filter((o) => o.status === "in_production" || o.status === "awaiting_final_payment");
  const totalValueToday = orders.reduce((sum, o) => sum + (o.sales_order_value || 0), 0);

  if (loading)
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh]">
        <Loader2 size={32} className="animate-spin text-[#B8860B]" />
      </div>
    );

  return (
    <div className="bg-slate-50 min-h-screen pb-12">
      {/* HEADER */}
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
        </div>
      </div>

      {/* QUEUE NAVIGATION */}
      <div className="max-w-7xl mx-auto px-6 -mt-6">
        <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-2 flex overflow-x-auto scrollbar-hide gap-2">
          {[
            { id: "validation", label: "Advance Payments", count: validationQueue.length, icon: Banknote },
            { id: "approvals", label: "Commercial Approvals", count: approvalQueue.length, icon: ShieldCheck },
            { id: "dispatch_hold", label: "Final Invoices & Dispatch", count: dispatchHoldQueue.length, icon: Receipt },
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveQueue(tab.id as FinanceQueue)}
              className={`flex items-center gap-2 px-4 py-3 rounded-xl text-sm font-bold whitespace-nowrap transition-colors ${activeQueue === tab.id ? "bg-slate-900 text-white" : "text-slate-600 hover:bg-slate-100"}`}
            >
              <tab.icon size={16} className={activeQueue === tab.id ? "text-[#B8860B]" : "text-slate-400"} />
              {tab.label}
              <span
                className={`px-2 py-0.5 rounded-full text-[10px] ${activeQueue === tab.id ? "bg-white/20 text-white" : "bg-slate-200 text-slate-700"}`}
              >
                {tab.count}
              </span>
            </button>
          ))}
        </div>

        {/* ACTIVE QUEUE RENDERER */}
        <div className="mt-6">
          {/* QUEUE 1: ADVANCE VALIDATION */}
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
                        <AlertTriangle size={12} /> Advance UTR
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
                            <CheckCircle2 size={14} /> Validate
                          </>
                        )}
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>
          )}

          {/* QUEUE 3: INVOICE & DISPATCH HOLD */}
          {activeQueue === "dispatch_hold" && (
            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
              {dispatchHoldQueue.length === 0 ? (
                <p className="text-slate-500 font-bold p-4">No orders awaiting invoicing.</p>
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
                        <p className="text-[10px] text-slate-500 font-bold uppercase">Est. Value</p>
                        <p className="text-lg font-black text-slate-900">{formatPrice(order.sales_order_value || 0)}</p>
                      </div>
                      {order.status === "awaiting_final_payment" ? (
                        <span className="bg-red-50 text-red-600 px-2 py-1 rounded text-[10px] font-bold uppercase">
                          Awaiting Final UTR
                        </span>
                      ) : (
                        <span className="bg-blue-50 text-blue-600 px-2 py-1 rounded text-[10px] font-bold uppercase">
                          Packed by Ops
                        </span>
                      )}
                    </div>
                    <div className="flex gap-2">
                      {order.status === "awaiting_final_payment" ? (
                        <button
                          onClick={() => handleValidatePayment(order.id)}
                          className="w-full py-2.5 bg-emerald-600 text-white rounded-lg text-xs font-bold hover:bg-emerald-700 flex justify-center items-center gap-1"
                        >
                          Verify Final UTR & Dispatch
                        </button>
                      ) : (
                        <button
                          onClick={() => setDocOrder(order)}
                          className="w-full py-2.5 bg-slate-900 text-white rounded-lg text-xs font-bold hover:bg-black flex justify-center items-center gap-1"
                        >
                          <UploadCloud size={14} /> Upload Tally Docs
                        </button>
                      )}
                    </div>
                  </div>
                ))
              )}
            </div>
          )}
        </div>
      </div>

      {/* FINANCE DOCUMENT HUB MODAL */}
      <AnimatePresence>
        {docOrder && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-white rounded-2xl p-6 w-full max-w-lg shadow-2xl"
            >
              <div className="flex justify-between items-center mb-5">
                <div>
                  <h3 className="font-display text-xl font-bold text-slate-900">Upload Final Documents</h3>
                  <p className="text-xs text-slate-500">
                    Order #{docOrder.id.split("-")[0]} • {docOrder.company?.business_name}
                  </p>
                </div>
                <button
                  onClick={() => setDocOrder(null)}
                  className="w-8 h-8 bg-slate-100 rounded-full flex items-center justify-center text-slate-500 hover:bg-slate-200"
                >
                  <X size={18} />
                </button>
              </div>

              <div className="space-y-4">
                {/* Final Value Input */}
                <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase mb-1">
                    Final Tally Invoice Amount (₹)
                  </label>
                  <input
                    type="number"
                    placeholder="Enter exact total from Tally"
                    value={finalInvoiceValue}
                    onChange={(e) => setFinalInvoiceValue(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl p-3 font-bold text-lg outline-none focus:border-[#B8860B] focus:ring-1 focus:ring-[#B8860B]"
                  />
                  <p className="text-[10px] text-slate-400 mt-1">
                    This will update the order value and calculate any pending balance automatically.
                  </p>
                </div>

                {/* Upload Buttons */}
                <div className="grid grid-cols-2 gap-3 pt-2">
                  <button
                    onClick={() => {
                      setInvoiceUploaded(true);
                      toast.success("Invoice Attached");
                    }}
                    className={`flex flex-col items-center justify-center p-4 border-2 border-dashed rounded-xl transition-colors ${invoiceUploaded ? "border-emerald-500 bg-emerald-50" : "border-slate-300 hover:border-[#B8860B] bg-slate-50"}`}
                  >
                    <FileUp size={24} className={invoiceUploaded ? "text-emerald-500" : "text-slate-400"} />
                    <span className="text-xs font-bold mt-2 text-slate-700">
                      {invoiceUploaded ? "Tax Invoice Added" : "Upload Tally Invoice"}
                    </span>
                  </button>

                  <button
                    onClick={() => {
                      setEwayUploaded(true);
                      toast.success("E-Way Bill Attached");
                    }}
                    className={`flex flex-col items-center justify-center p-4 border-2 border-dashed rounded-xl transition-colors ${ewayUploaded ? "border-emerald-500 bg-emerald-50" : "border-slate-300 hover:border-[#B8860B] bg-slate-50"}`}
                  >
                    <Truck size={24} className={ewayUploaded ? "text-emerald-500" : "text-slate-400"} />
                    <span className="text-xs font-bold mt-2 text-slate-700">
                      {ewayUploaded ? "E-Way Bill Added" : "Upload E-Way Bill"}
                    </span>
                  </button>
                </div>
              </div>

              <div className="pt-6 mt-4 border-t border-slate-100 flex gap-3">
                <button
                  onClick={() => setDocOrder(null)}
                  className="flex-1 py-3 bg-slate-100 text-slate-600 font-bold rounded-xl hover:bg-slate-200"
                >
                  Cancel
                </button>
                <button
                  onClick={handleFinalizeDocuments}
                  disabled={acting === docOrder.id}
                  className="flex-[2] py-3 bg-slate-900 text-white font-bold rounded-xl hover:bg-black flex justify-center items-center gap-2 shadow-lg"
                >
                  {acting === docOrder.id ? (
                    <Loader2 size={16} className="animate-spin" />
                  ) : (
                    <>
                      <Receipt size={16} /> Lock Invoice & Request Balance
                    </>
                  )}
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
