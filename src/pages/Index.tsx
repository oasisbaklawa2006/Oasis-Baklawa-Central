import AiOrderModal from "@/components/AiOrderModal";
import AppShell from "@/components/AppShell";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import {
  Loader2,
  Package,
  CheckCircle2,
  Clock,
  Truck,
  Receipt,
  UploadCloud,
  ChevronRight,
  FileText,
  AlertTriangle,
  X,
  Megaphone,
  Download,
  Ticket,
  TrendingUp,
  IndianRupee,
  Sparkles,
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { toast } from "sonner";
import { useNavigate } from "react-router-dom";

const formatPrice = (n: number) => "₹" + n.toLocaleString("en-IN");
const formatDate = (dateString: string) =>
  new Date(dateString).toLocaleDateString("en-IN", {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });

const Dashboard = () => {
  // ALL hooks must be inside this function block!
  const navigate = useNavigate();
  const [orders, setOrders] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [companyName, setCompanyName] = useState("Oasis Partner");
  const [isAiModalOpen, setIsAiModalOpen] = useState(false);

  // UTR Modal State
  const [utrModal, setUtrModal] = useState<{ isOpen: boolean; orderId: string | null; type: "advance" | "final" }>({
    isOpen: false,
    orderId: null,
    type: "advance",
  });
  const [utrRef, setUtrRef] = useState("");
  const [isUploading, setIsUploading] = useState(false);

  const fetchDashboardData = async () => {
    setLoading(true);
    // Fetch orders with item details to calculate Top Sellers
    const { data: orderData, error } = await supabase
      .from("orders")
      .select("*, company:companies(business_name), order_items(*, product:products(name))")
      .order("created_at", { ascending: false });

    if (!error && orderData) {
      setOrders(orderData);
      if (orderData[0]?.company?.business_name) {
        setCompanyName(orderData[0].company.business_name);
      }
    }
    setLoading(false);
  };

  useEffect(() => {
    fetchDashboardData();
  }, []);

  const handleUploadReceipt = async () => {
    if (!utrRef) {
      toast.error("Please enter the Bank Reference No. / Transaction ID.");
      return;
    }
    setIsUploading(true);
    setTimeout(() => {
      toast.success("Payment Receipt Uploaded Successfully! Awaiting Finance Verification.", { icon: "✅" });
      setUtrModal({ isOpen: false, orderId: null, type: "advance" });
      setUtrRef("");
      setIsUploading(false);
    }, 1500);
  };

  // KPIs Calculations
  const totalBusiness = orders.reduce((sum, o) => sum + (o.sales_order_value || 0), 0);
  const totalOrders = orders.length;

  // Find Top Selling Product for this customer
  const productCounts: Record<string, number> = {};
  orders.forEach((o) => {
    o.order_items?.forEach((item: any) => {
      const name = item.product?.name;
      if (name) productCounts[name] = (productCounts[name] || 0) + item.quantity;
    });
  });
  const topProduct = Object.entries(productCounts).sort((a, b) => b[1] - a[1])[0]?.[0] || "N/A";

  const activeOrders = orders.filter((o) => o.status !== "delivered" && o.status !== "cancelled");
  const latestOrder = activeOrders[0]; // The order currently in transit/production

  const getTimelineStep = (order: any) => {
    if (order.status === "dispatched") return 4;
    if (order.status === "awaiting_final_payment" || order.status === "cleared_for_dispatch") return 3;
    if (order.status === "in_production" || order.status === "packed_ready") return 2;
    return 1; // submitted / awaiting_receipt
  };

  if (loading)
    return (
      <AppShell>
        <div className="flex flex-col items-center justify-center min-h-[60vh]">
          <Loader2 size={32} className="animate-spin text-[#B8860B]" />
          <p className="mt-4 text-slate-500 font-bold text-xs uppercase tracking-widest">Loading Dashboard...</p>
        </div>
      </AppShell>
    );

  return (
    <AppShell>
      {/* GLOBAL MARQUEE */}
      <div className="bg-[#B8860B] text-white text-xs font-bold py-2 overflow-hidden relative flex items-center">
        <div className="absolute left-2 z-10 bg-[#B8860B] pr-2">
          <Megaphone size={14} />
        </div>
        <div className="whitespace-nowrap animate-[marquee_15s_linear_infinite] ml-8">
          Welcome to the new Oasis B2B Portal! • Dispatch SLAs are currently 48 hours from advance payment • Festive
          Pre-Booking opens next week! • Contact support for volume discounts.
        </div>
      </div>

      <style>{`
        @keyframes marquee {
          0% { transform: translateX(100%); }
          100% { transform: translateX(-100%); }
        }
      `}</style>

      <div className="max-w-4xl mx-auto pb-24 px-4 sm:px-6 pt-6 space-y-8">
        {/* HEADER & FINANCIAL INSIGHTS */}
        <section>
          <h1 className="font-display text-2xl font-bold text-slate-900">Welcome back, {companyName}</h1>
          <p className="text-sm font-medium text-slate-500 mt-1 mb-6">Here is your business overview.</p>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm">
              <TrendingUp size={16} className="text-[#B8860B] mb-2" />
              <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">Total Business</p>
              <p className="font-black text-lg text-slate-900">{formatPrice(totalBusiness)}</p>
            </div>
            <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm">
              <Package size={16} className="text-blue-500 mb-2" />
              <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">Total Orders</p>
              <p className="font-black text-lg text-slate-900">{totalOrders} Batches</p>
            </div>
            <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm">
              <IndianRupee size={16} className="text-emerald-500 mb-2" />
              <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">Wallet Balance</p>
              <p className="font-black text-lg text-slate-900">
                ₹0 <span className="text-[10px] font-medium text-slate-400 block">No pending refunds</span>
              </p>
            </div>
            <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm">
              <TrendingUp size={16} className="text-purple-500 mb-2" />
              <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">Most Ordered</p>
              <p className="font-black text-sm text-slate-900 leading-tight mt-1">{topProduct}</p>
            </div>
          </div>
        </section>

        {/* QUICK ACTION BUTTONS */}
        <section className="grid grid-cols-2 gap-3">
          <button
            onClick={() => toast.info("Opening Document Library...")}
            className="bg-slate-900 text-white p-4 rounded-2xl flex items-center justify-between hover:bg-black active:scale-95 transition-all shadow-md"
          >
            <div className="text-left">
              <p className="font-bold text-sm">Download Docs</p>
              <p className="text-[10px] text-slate-400">Invoices & E-Way Bills</p>
            </div>
            <Download size={20} className="text-[#B8860B]" />
          </button>
          <button
            onClick={() => toast.info("Opening Support Desk...")}
            className="bg-white border border-slate-200 text-slate-800 p-4 rounded-2xl flex items-center justify-between hover:bg-slate-50 active:scale-95 transition-all shadow-sm"
          >
            <div className="text-left">
              <p className="font-bold text-sm">Raise Ticket</p>
              <p className="text-[10px] text-slate-500">Support & Complaints</p>
            </div>
            <Ticket size={20} className="text-rose-500" />
          </button>
          <button
            onClick={() => setIsAiModalOpen(true)}
            className="bg-[#B8860B] text-white p-4 rounded-2xl flex items-center justify-between hover:bg-[#9A7009] active:scale-95 transition-all shadow-md col-span-2 mt-3"
          >
            <div className="text-left">
              <p className="font-bold text-sm flex items-center gap-2">
                <Sparkles size={16} /> Quick Order via AI
              </p>
              <p className="text-[10px] text-white/80 mt-0.5">
                Type or paste a Purchase Order to build your cart instantly.
              </p>
            </div>
            <ChevronRight size={20} className="text-white/50" />
          </button>
        </section>

        {/* LIVE TRACKING TIMELINE */}
        <section>
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-sm font-bold text-slate-800 uppercase tracking-widest flex items-center gap-2">
              <Clock size={16} className="text-[#B8860B]" /> Live Order Tracker
            </h2>
            <button onClick={() => navigate("/orders")} className="text-xs font-bold text-[#B8860B] hover:underline">
              View All
            </button>
          </div>

          {!latestOrder ? (
            <div className="bg-white rounded-3xl border border-slate-200 p-8 text-center shadow-sm">
              <Package size={32} className="mx-auto text-slate-300 mb-3" />
              <p className="text-slate-500 text-sm font-medium mb-4">No active shipments in transit.</p>
              <button
                onClick={() => navigate("/catalogue")}
                className="px-6 py-2.5 bg-[#B8860B] text-white rounded-xl font-bold text-xs shadow-md"
              >
                Start New Order
              </button>
            </div>
          ) : (
            <div className="bg-white rounded-[2rem] border border-slate-200 shadow-md overflow-hidden relative">
              {/* Tracker Header */}
              <div className="bg-slate-50 border-b border-slate-100 p-5 flex justify-between items-center">
                <div>
                  <p className="text-[10px] text-slate-500 font-bold uppercase tracking-widest mb-0.5">
                    SO #{latestOrder.id.split("-")[0].toUpperCase()}
                  </p>
                  <p className="font-black text-lg text-slate-900">{formatPrice(latestOrder.sales_order_value || 0)}</p>
                </div>
                <div className="text-right">
                  <p className="text-[10px] text-slate-500 font-bold mb-0.5">Placed On</p>
                  <p className="text-xs font-bold text-slate-800">{formatDate(latestOrder.created_at)}</p>
                </div>
              </div>

              {/* TIMELINE UI */}
              <div className="p-6 relative">
                <div className="absolute left-10 top-10 bottom-10 w-0.5 bg-slate-100"></div>

                {/* Step 1: Order Placed & Advance */}
                <div className="relative flex items-start gap-4 mb-8">
                  <div
                    className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 z-10 ${getTimelineStep(latestOrder) >= 1 ? "bg-emerald-500 text-white shadow-md shadow-emerald-500/20" : "bg-slate-100 text-slate-400"}`}
                  >
                    <CheckCircle2 size={16} />
                  </div>
                  <div className="flex-1 pt-1.5">
                    <h4 className="font-bold text-slate-900 text-sm">Order Logged</h4>

                    {latestOrder.payment_status === "awaiting_receipt" ? (
                      <div className="mt-3 bg-amber-50 border border-amber-200 rounded-xl p-4 shadow-inner">
                        <p className="text-xs font-bold text-amber-800 flex items-center gap-1.5 mb-2">
                          <AlertTriangle size={14} /> Action Required
                        </p>
                        <p className="text-[11px] text-amber-700 mb-3">
                          Please transfer the 50% advance and upload the payment receipt to release this to Production.
                        </p>
                        <button
                          onClick={() => setUtrModal({ isOpen: true, orderId: latestOrder.id, type: "advance" })}
                          className="w-full py-2 bg-[#B8860B] text-white rounded-lg text-xs font-bold shadow-sm flex justify-center items-center gap-2"
                        >
                          <UploadCloud size={14} /> Upload Advance Receipt
                        </button>
                      </div>
                    ) : (
                      <p className="text-xs text-slate-500 font-medium mt-0.5">Financials verified. Released to Production.</p>
                    )}
                  </div>
                </div>

                {/* Step 2: Production & Assembly */}
                <div className="relative flex items-start gap-4 mb-8">
                  <div
                    className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 z-10 transition-colors ${getTimelineStep(latestOrder) >= 2 ? "bg-[#B8860B] text-white shadow-md shadow-[#B8860B]/20" : "bg-slate-100 text-slate-300"}`}
                  >
                    <Package size={16} />
                  </div>
                  <div className="flex-1 pt-1.5">
                    <h4
                      className={`font-bold text-sm ${getTimelineStep(latestOrder) >= 2 ? "text-slate-900" : "text-slate-400"}`}
                    >
                      Production & Assembly
                    </h4>
                    {getTimelineStep(latestOrder) === 2 && (
                      <p className="text-xs text-[#B8860B] font-bold mt-1 flex items-center gap-1">
                        <Loader2 size={12} className="animate-spin" /> Packaging division is assembling your master cartons
                      </p>
                    )}
                  </div>
                </div>

                {/* Step 3: Final Invoice & Payment */}
                <div className="relative flex items-start gap-4 mb-8">
                  <div
                    className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 z-10 transition-colors ${getTimelineStep(latestOrder) >= 3 ? "bg-blue-500 text-white shadow-md shadow-blue-500/20" : "bg-slate-100 text-slate-300"}`}
                  >
                    <Receipt size={16} />
                  </div>
                  <div className="flex-1 pt-1.5">
                    <h4
                      className={`font-bold text-sm ${getTimelineStep(latestOrder) >= 3 ? "text-slate-900" : "text-slate-400"}`}
                    >
                      Final Invoicing
                    </h4>

                    {latestOrder.status === "awaiting_final_payment" && (
                      <div className="mt-3 bg-blue-50 border border-blue-200 rounded-xl p-4 shadow-inner">
                        <p className="text-xs font-bold text-blue-800 flex items-center gap-1.5 mb-2">
                          <AlertTriangle size={14} /> Final Payment Required
                        </p>
                        <p className="text-[11px] text-blue-700 mb-3">
                          Finance has generated the final tax invoice based on actual packed weights. Please clear the
                          due balance.
                        </p>
                        <div className="flex gap-2">
                          <button className="flex-1 py-2 bg-white border border-blue-200 text-blue-800 rounded-lg text-[10px] font-bold shadow-sm flex justify-center items-center gap-1 hover:bg-blue-100">
                            <FileText size={12} /> View Invoice
                          </button>
                          <button
                            onClick={() => setUtrModal({ isOpen: true, orderId: latestOrder.id, type: "final" })}
                            className="flex-1 py-2 bg-blue-600 text-white rounded-lg text-[10px] font-bold shadow-sm hover:bg-blue-700 flex justify-center items-center gap-1"
                          >
                            <UploadCloud size={12} /> Upload Final Receipt
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                </div>

                {/* Step 4: Dispatched (With Details) */}
                <div className="relative flex items-start gap-4">
                  <div
                    className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 z-10 transition-colors ${getTimelineStep(latestOrder) >= 4 ? "bg-emerald-600 text-white shadow-md shadow-emerald-600/30" : "bg-slate-100 text-slate-300"}`}
                  >
                    <Truck size={16} />
                  </div>
                  <div className="flex-1 pt-1.5">
                    <h4
                      className={`font-bold text-sm ${getTimelineStep(latestOrder) >= 4 ? "text-slate-900" : "text-slate-400"}`}
                    >
                      Dispatched
                    </h4>
                    {getTimelineStep(latestOrder) >= 4 && (
                      <div className="mt-3 bg-slate-50 border border-slate-200 rounded-xl p-3">
                        <div className="flex justify-between items-center text-[10px] font-bold text-slate-600 border-b border-slate-200 pb-2 mb-2">
                          <span>
                            Courier: <span className="text-slate-900">Delhivery Surface</span>
                          </span>
                          <span>
                            AWB: <span className="text-[#B8860B]">13884849200</span>
                          </span>
                        </div>
                        <div className="flex gap-2">
                          <button className="flex-1 py-1.5 bg-white border border-slate-200 text-slate-600 rounded-lg text-[10px] font-bold hover:bg-slate-100 shadow-sm flex justify-center items-center gap-1">
                            <Truck size={10} /> Track Status
                          </button>
                          <button className="flex-1 py-1.5 bg-white border border-slate-200 text-slate-600 rounded-lg text-[10px] font-bold hover:bg-slate-100 shadow-sm flex justify-center items-center gap-1">
                            <FileText size={10} /> E-Way Bill
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>
          )}
        </section>

        {/* TOOLS DIRECTORY GRID */}
        <section>
          <h2 className="text-sm font-bold text-slate-800 uppercase tracking-widest flex items-center gap-2 mb-4">
            <Package size={16} className="text-[#B8860B]" /> Quick Tools
          </h2>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
            {[
              { label: "Product Catalogue", desc: "Browse & order products", path: "/catalogue", icon: "📦" },
              { label: "My Orders", desc: "Track all your batches", path: "/orders", icon: "📋" },
              { label: "Buyer Portal", desc: "Account & company info", path: "/buyer-portal", icon: "🏢" },
              { label: "Documents", desc: "Invoices & E-Way Bills", path: "/documents", icon: "📄" },
              { label: "Favorites", desc: "Quick reorder list", path: "/favorites", icon: "⭐" },
              { label: "My Account", desc: "Profile & settings", path: "/account", icon: "👤" },
            ].map((tool) => (
              <button
                key={tool.path}
                onClick={() => navigate(tool.path)}
                className="bg-white border border-slate-200 rounded-2xl p-4 text-left hover:border-[#B8860B]/40 hover:shadow-md active:scale-[0.98] transition-all shadow-sm"
              >
                <span className="text-2xl mb-2 block">{tool.icon}</span>
                <p className="font-bold text-sm text-slate-900">{tool.label}</p>
                <p className="text-[10px] text-slate-500 font-medium mt-0.5">{tool.desc}</p>
              </button>
            ))}
          </div>
        </section>
      </div>

      {/* UTR UPLOAD MODAL */}
      <AnimatePresence>
        {utrModal.isOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-white rounded-3xl p-6 w-full max-w-sm shadow-2xl"
            >
              <div className="flex justify-between items-center mb-5">
                <h3 className="font-display text-xl font-bold text-slate-900">Upload Payment Receipt</h3>
                <button
                  onClick={() => setUtrModal({ isOpen: false, orderId: null, type: "advance" })}
                  className="w-8 h-8 bg-slate-100 rounded-full flex items-center justify-center text-slate-500 hover:bg-slate-200"
                >
                  <X size={18} />
                </button>
              </div>

              <div className="space-y-4">
                <div className="bg-slate-50 p-4 border-2 border-dashed border-slate-300 rounded-2xl flex flex-col items-center justify-center text-center cursor-pointer hover:border-[#B8860B] hover:bg-amber-50/30 transition-colors">
                  <UploadCloud size={32} className="text-slate-400 mb-2" />
                  <p className="text-sm font-bold text-slate-700">Tap to browse files</p>
                  <p className="text-[10px] text-slate-500 mt-1">Upload Bank Screenshot (JPG, PNG, PDF)</p>
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-slate-500 uppercase mb-1.5">
                    Bank Reference No. / Transaction ID
                  </label>
                  <input
                    type="text"
                    placeholder="e.g., REF1234567890"
                    value={utrRef}
                    onChange={(e) => setUtrRef(e.target.value)}
                    className="w-full bg-white border border-slate-200 rounded-xl p-3 text-sm font-bold outline-none focus:border-[#B8860B]"
                  />
                </div>
              </div>

              <button
                onClick={handleUploadReceipt}
                disabled={isUploading || !utrRef}
                className="w-full mt-6 py-4 bg-slate-900 text-white font-bold rounded-xl hover:bg-black flex justify-center items-center gap-2 shadow-lg disabled:opacity-50 transition-all"
              >
                {isUploading ? <Loader2 size={18} className="animate-spin" /> : "Submit Receipt for Verification"}
              </button>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
      <AiOrderModal isOpen={isAiModalOpen} onClose={() => setIsAiModalOpen(false)} />
    </AppShell>
  );
};

export default Dashboard;
