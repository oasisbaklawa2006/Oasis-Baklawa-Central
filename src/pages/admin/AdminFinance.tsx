import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
// ADDED 'Package' TO THE IMPORTS BELOW
import {
  Loader2,
  CheckCircle2,
  AlertTriangle,
  FileText,
  Search,
  ShieldCheck,
  Receipt,
  UploadCloud,
  FileUp,
  X,
  Banknote,
  Calculator,
  Link,
  Package,
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

interface FinanceOrder {
  id: string;
  status: string;
  payment_status: string | null;
  sales_order_value: number | null;
  advance_paid: number | null;
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

type FinanceQueue = "validation" | "approvals" | "invoicing";

const AdminFinance = () => {
  const [orders, setOrders] = useState<FinanceOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [acting, setActing] = useState<string | null>(null);
  const [activeQueue, setActiveQueue] = useState<FinanceQueue>("validation");

  // Invoicing Modal State
  const [docOrder, setDocOrder] = useState<FinanceOrder | null>(null);
  const [tallyAmount, setTallyAmount] = useState("");
  const [tallyInvoiceNo, setTallyInvoiceNo] = useState("");
  const [soNumber, setSoNumber] = useState("");
  const [invoiceUploaded, setInvoiceUploaded] = useState(false);

  const fetchOrders = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("orders")
      .select(
        "id, status, payment_status, sales_order_value, advance_paid, created_at, company_id, company:companies(business_name)",
      )
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
      toast.success("Advance Verified. Cleared for Dispatch Team to pack.");
      fetchOrders();
    } catch (err) {
      toast.error("Action failed.");
    }
    setActing(null);
  };

  // THE NEW EXACT WORKFLOW SUBMIT
  const handleRequestBalance = async () => {
    if (!docOrder || !tallyAmount || !tallyInvoiceNo || !invoiceUploaded) {
      toast.error("Please fill all Tally details and attach the PDF.");
      return;
    }
    setActing(docOrder.id);
    try {
      await supabase
        .from("orders")
        .update({
          sales_order_value: parseFloat(tallyAmount), // Overwrite with exact Tally amount
          status: "awaiting_final_payment",
        })
        .eq("id", docOrder.id);

      toast.success("Invoice Locked! Payment request sent to customer.");
      setDocOrder(null);
      setInvoiceUploaded(false);
      setTallyAmount("");
      setTallyInvoiceNo("");
      fetchOrders();
    } catch (err) {
      toast.error("Upload failed.");
    }
    setActing(null);
  };

  // Queues
  const validationQueue = orders.filter((o) => o.payment_status === "awaiting_receipt");
  const approvalQueue = orders.filter((o) => o.payment_status === "credit_requested");
  // Assuming 'packed_ready' is the status Operations sets after putting items in boxes
  const invoicingQueue = orders.filter((o) => o.status === "in_production" || o.status === "packed_ready");

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
        <div className="max-w-7xl mx-auto flex justify-between items-end mb-8">
          <div>
            <h1 className="font-display text-3xl font-bold">Finance Control Tower</h1>
            <p className="text-sm text-slate-400 mt-1">Approval, invoicing, and payment validation.</p>
          </div>
          <div className="text-right">
            <p className="text-xs text-slate-400 uppercase tracking-widest font-bold">Total Exposure</p>
            <p className="text-2xl font-black text-[#B8860B]">{formatPrice(totalValueToday)}</p>
          </div>
        </div>
      </div>

      {/* QUEUE NAVIGATION */}
      <div className="max-w-7xl mx-auto px-6 -mt-6">
        <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-2 flex overflow-x-auto scrollbar-hide gap-2">
          {[
            { id: "validation", label: "Advance UTRs", count: validationQueue.length, icon: Banknote },
            { id: "approvals", label: "Credit Approvals", count: approvalQueue.length, icon: ShieldCheck },
            { id: "invoicing", label: "Post-Pack Invoicing", count: invoicingQueue.length, icon: Calculator },
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
                        <p className="text-xs text-slate-400 font-bold uppercase">SO #{order.id.split("-")[0]}</p>
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
                            <CheckCircle2 size={14} /> Verify Advance
                          </>
                        )}
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>
          )}

          {/* QUEUE 3: POST-PACK INVOICING */}
          {activeQueue === "invoicing" && (
            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
              {invoicingQueue.length === 0 ? (
                <p className="text-slate-500 font-bold p-4">No orders packed and awaiting invoice.</p>
              ) : (
                invoicingQueue.map((order) => (
                  <div key={order.id} className="bg-white border-l-4 border-[#B8860B] rounded-xl p-5 shadow-sm">
                    <div className="flex justify-between items-start border-b border-slate-100 pb-3 mb-3">
                      <div>
                        <p className="text-xs text-slate-400 font-bold uppercase">SO #{order.id.split("-")[0]}</p>
                        <p className="font-black text-slate-900 text-lg">{order.company?.business_name}</p>
                      </div>
                    </div>
                    <div className="flex justify-between items-center mb-5">
                      <div>
                        <p className="text-[10px] text-slate-500 font-bold uppercase">Packed Value Est.</p>
                        <p className="text-lg font-black text-slate-900">{formatPrice(order.sales_order_value || 0)}</p>
                      </div>
                      <span className="bg-blue-50 text-blue-600 px-2 py-1 rounded text-[10px] font-bold uppercase flex items-center gap-1">
                        <Package size={12} /> Packed by Ops
                      </span>
                    </div>
                    <button
                      onClick={() => {
                        setDocOrder(order);
                        setSoNumber(`SO-${order.id.split("-")[0].toUpperCase()}`);
                      }}
                      className="w-full py-2.5 bg-slate-900 text-white rounded-lg text-xs font-bold hover:bg-black flex justify-center items-center gap-1.5"
                    >
                      <Calculator size={14} /> Process Final Invoice
                    </button>
                  </div>
                ))
              )}
            </div>
          )}
        </div>
      </div>

      {/* FINANCE INVOICING MODAL (EXACT WORKFLOW) */}
      <AnimatePresence>
        {docOrder && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm overflow-y-auto">
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-white rounded-3xl w-full max-w-2xl shadow-2xl my-8"
            >
              {/* Modal Header */}
              <div className="flex justify-between items-center p-6 border-b border-slate-100">
                <div>
                  <h3 className="font-display text-2xl font-bold text-slate-900">Process Final Invoice</h3>
                  <p className="text-sm text-slate-500 mt-1">{docOrder.company?.business_name}</p>
                </div>
                <button
                  onClick={() => setDocOrder(null)}
                  className="w-10 h-10 bg-slate-100 rounded-full flex items-center justify-center text-slate-500 hover:bg-slate-200"
                >
                  <X size={20} />
                </button>
              </div>

              <div className="p-6 space-y-6">
                {/* 1. INTERNAL AUTO-CALCULATION (Read-Only) */}
                <div className="bg-slate-50 rounded-2xl border border-slate-200 p-5">
                  <h4 className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-4 flex items-center gap-2">
                    <Calculator size={14} /> Internal Reconciliation Sheet
                  </h4>

                  <div className="space-y-2 text-sm">
                    <div className="flex justify-between text-slate-600">
                      <span>Packed Items Value (As per Slab)</span>
                      <span className="font-bold">{formatPrice((docOrder.sales_order_value || 0) * 0.82)}</span>
                    </div>
                    <div className="flex justify-between text-slate-600 border-b border-slate-200 pb-3">
                      <span>Estimated GST (18%)</span>
                      <span className="font-bold">{formatPrice((docOrder.sales_order_value || 0) * 0.18)}</span>
                    </div>
                    <div className="flex justify-between text-slate-900 font-bold pt-1">
                      <span>Gross Invoice Value</span>
                      <span>{formatPrice(docOrder.sales_order_value || 0)}</span>
                    </div>
                    <div className="flex justify-between text-emerald-600 font-bold">
                      <span>Less: Advance Paid</span>
                      <span>- {formatPrice(docOrder.advance_paid || 0)}</span>
                    </div>
                    <div className="flex justify-between text-blue-600 font-bold border-b border-slate-200 pb-3">
                      <span>Less: Wallet / Previous Credit</span>
                      <span>- ₹0</span>
                    </div>
                    <div className="flex justify-between items-center pt-2">
                      <span className="text-xs uppercase tracking-widest text-slate-500 font-bold">
                        Calculated Due Balance
                      </span>
                      <span className="font-black text-xl text-[#B8860B]">
                        {formatPrice((docOrder.sales_order_value || 0) - (docOrder.advance_paid || 0))}
                      </span>
                    </div>
                  </div>
                </div>

                {/* 2. TALLY DATA ENTRY (Manual Input) */}
                <div className="space-y-4">
                  <h4 className="text-xs font-bold text-slate-400 uppercase tracking-widest flex items-center gap-2">
                    <Receipt size={14} /> Enter Official Tally Details
                  </h4>

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-[11px] font-bold text-slate-500 uppercase mb-1.5">
                        Generated Against SO #
                      </label>
                      <input
                        type="text"
                        value={soNumber}
                        onChange={(e) => setSoNumber(e.target.value)}
                        className="w-full bg-white border border-slate-200 rounded-xl p-3 text-sm font-bold outline-none focus:border-[#B8860B]"
                      />
                    </div>
                    <div>
                      <label className="block text-[11px] font-bold text-slate-500 uppercase mb-1.5">
                        Official Tally Inv #
                      </label>
                      <input
                        type="text"
                        placeholder="e.g. INV/25-26/042"
                        value={tallyInvoiceNo}
                        onChange={(e) => setTallyInvoiceNo(e.target.value)}
                        className="w-full bg-white border border-slate-200 rounded-xl p-3 text-sm font-bold outline-none focus:border-[#B8860B]"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-[11px] font-bold text-slate-500 uppercase mb-1.5">
                      Exact Tally Amount (₹)
                    </label>
                    <input
                      type="number"
                      placeholder="Enter final amount to adjust round-offs"
                      value={tallyAmount}
                      onChange={(e) => setTallyAmount(e.target.value)}
                      className="w-full bg-white border border-slate-200 rounded-xl p-3 text-lg font-black text-[#B8860B] outline-none focus:border-[#B8860B]"
                    />
                  </div>
                </div>

                {/* 3. FILE UPLOAD */}
                <div>
                  <button
                    onClick={() => {
                      setInvoiceUploaded(true);
                      toast.success("Tally PDF Attached");
                    }}
                    className={`w-full flex items-center justify-center gap-3 p-4 border-2 border-dashed rounded-xl transition-all ${invoiceUploaded ? "border-emerald-500 bg-emerald-50 text-emerald-700" : "border-slate-300 hover:border-[#B8860B] bg-slate-50 text-slate-500"}`}
                  >
                    {invoiceUploaded ? <CheckCircle2 size={20} /> : <FileUp size={20} />}
                    <span className="text-sm font-bold">
                      {invoiceUploaded ? "Tax Invoice Attached" : "Upload Tally Tax Invoice (PDF)"}
                    </span>
                  </button>
                </div>
              </div>

              {/* ACTION FOOTER */}
              <div className="p-6 border-t border-slate-100 flex gap-3 bg-slate-50 rounded-b-3xl">
                <button
                  onClick={() => setDocOrder(null)}
                  className="px-6 py-4 bg-white border border-slate-200 text-slate-600 font-bold rounded-xl hover:bg-slate-100"
                >
                  Cancel
                </button>
                <button
                  onClick={handleRequestBalance}
                  disabled={acting === docOrder.id}
                  className="flex-1 py-4 bg-slate-900 text-white font-bold rounded-xl hover:bg-black flex justify-center items-center gap-2 shadow-xl shadow-slate-900/20 active:scale-95 transition-all"
                >
                  {acting === docOrder.id ? (
                    <Loader2 size={18} className="animate-spin" />
                  ) : (
                    <>
                      <Link size={18} /> Lock Invoice & Request Balance
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
