import AppShell from "@/components/AppShell";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import {
  Package,
  Clock,
  Truck,
  FileText,
  Ticket,
  TrendingUp,
  IndianRupee,
  Sparkles,
  ArrowRight,
  ListOrdered,
  Building2,
  Star,
  User,
  Download,
  Headphones,
  Megaphone,
  AlertTriangle,
  UploadCloud,
  X,
  Loader2,
  CheckCircle2,
  Receipt,
} from "lucide-react";
import { useNavigate } from "react-router-dom";
import AiOrderModal from "@/components/AiOrderModal";
import { motion, AnimatePresence } from "framer-motion";
import { toast } from "sonner";

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
  const navigate = useNavigate();
  const [orders, setOrders] = useState<any[]>([]);
  const [companyName, setCompanyName] = useState("Oasis Admin Master");
  const [isAiModalOpen, setIsAiModalOpen] = useState(false);

  // Modal & Upload State
  const [utrModal, setUtrModal] = useState<{ isOpen: boolean; orderId: string | null; type: "advance" | "final" }>({
    isOpen: false,
    orderId: null,
    type: "advance",
  });
  const [utrRef, setUtrRef] = useState("");
  const [isUploading, setIsUploading] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);

  const fetchDashboardData = async () => {
    const { data } = await supabase
      .from("orders")
      .select("*, company:companies(business_name), order_items(*, product:products(name))")
      .order("created_at", { ascending: false });
    if (data) {
      setOrders(data);
      if (data[0]?.company?.business_name) setCompanyName(data[0].company.business_name);
    }
  };

  useEffect(() => {
    fetchDashboardData();
  }, []);

  const handleUploadReceipt = async () => {
    if (!utrRef || !selectedFile || !utrModal.orderId) {
      toast.error("Please ensure you have entered a reference number and attached a file.");
      return;
    }

    setIsUploading(true);

    try {
      const fileExt = selectedFile.name.split(".").pop();
      const filePath = `receipts/${utrModal.orderId}-${Date.now()}.${fileExt}`;

      const { error: uploadError } = await supabase.storage.from("trade_documents").upload(filePath, selectedFile);
      if (uploadError) throw uploadError;

      const nextPaymentStatus = utrModal.type === "advance" ? "awaiting_verification" : "final_payment_review";

      const { error: updateError } = await supabase
        .from("orders")
        .update({ payment_status: nextPaymentStatus })
        .eq("id", utrModal.orderId);

      if (updateError) throw updateError;

      toast.success("Payment Receipt Uploaded! Awaiting Finance Verification.", { icon: "✅" });
      setUtrModal({ isOpen: false, orderId: null, type: "advance" });
      setUtrRef("");
      setSelectedFile(null);
      fetchDashboardData();
    } catch (err: any) {
      toast.error(err.message || "Failed to upload receipt.");
    } finally {
      setIsUploading(false);
    }
  };

  const totalBusiness = orders.reduce((sum, o) => sum + (o.sales_order_value || 0), 0);
  const activeOrders = orders.filter((o) => o.status !== "delivered" && o.status !== "cancelled");
  const latestOrder = activeOrders[0];

  const getTimelineStep = (order: any) => {
    if (order.status === "dispatched") return 4;
    if (order.status === "awaiting_final_payment" || order.status === "cleared_for_dispatch") return 3;
    if (order.status === "in_production" || order.status === "packed_ready") return 2;
    return 1;
  };

  const QUICK_TOOLS = [
    { icon: Package, label: "Product Catalogue", path: "/catalogue" },
    { icon: ListOrdered, label: "My Orders", path: "/orders" },
    { icon: Building2, label: "Buyer Portal", path: "/dashboard" },
    { icon: FileText, label: "Documents", path: "/dashboard" },
    { icon: Star, label: "Favorites", path: "/catalogue" },
    { icon: User, label: "My Account", path: "/account" },
  ];

  return (
    <AppShell>
      {/* GLOBAL MARQUEE BANNER */}
      <div className="bg-[#C5A059] text-white text-xs font-bold py-2.5 overflow-hidden relative flex items-center shadow-sm z-30">
        <div className="absolute left-4 z-10 bg-[#C5A059] pr-3 border-r border-white/20">
          <Megaphone size={14} />
        </div>
        <div className="whitespace-nowrap animate-[marquee_15s_linear_infinite] ml-12">
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

      <div className="min-h-screen bg-[#FDFCF8] font-sans pb-24">
        <main className="px-4 sm:px-6 max-w-5xl mx-auto space-y-8">
          {/* HEADER & KPIs */}
          <section>
            <h1 className="font-serif text-3xl font-bold text-gray-900 tracking-tight">Welcome back, {companyName}</h1>
            <p className="text-sm font-medium text-gray-500 mt-1 mb-6">Here is your business overview.</p>

            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="bg-white p-5 rounded-2xl border border-gray-100 shadow-[0_4px_20px_-4px_rgba(0,0,0,0.05)]">
                <TrendingUp size={16} className="text-[#C5A059] mb-3" />
                <p className="text-[10px] text-gray-400 font-bold uppercase tracking-widest mb-1">Total Business</p>
                <p className="font-black text-xl text-gray-900">{formatPrice(totalBusiness || 927000)}</p>
              </div>
              <div className="bg-white p-5 rounded-2xl border border-gray-100 shadow-[0_4px_20px_-4px_rgba(0,0,0,0.05)]">
                <Package size={16} className="text-[#3B82F6] mb-3" />
                <p className="text-[10px] text-gray-400 font-bold uppercase tracking-widest mb-1">Total Orders</p>
                <p className="font-black text-xl text-gray-900">{orders.length || 47} Batches</p>
              </div>
              <div className="bg-white p-5 rounded-2xl border border-gray-100 shadow-[0_4px_20px_-4px_rgba(0,0,0,0.05)]">
                <IndianRupee size={16} className="text-[#10B981] mb-3" />
                <p className="text-[10px] text-gray-400 font-bold uppercase tracking-widest mb-1">Wallet Balance</p>
                <p className="font-black text-xl text-gray-900">
                  ₹0 <span className="text-[10px] font-medium text-gray-400 block mt-0.5">No pending refunds</span>
                </p>
              </div>
              <div className="bg-white p-5 rounded-2xl border border-gray-100 shadow-[0_4px_20px_-4px_rgba(0,0,0,0.05)]">
                <TrendingUp size={16} className="text-[#8B5CF6] mb-3" />
                <p className="text-[10px] text-gray-400 font-bold uppercase tracking-widest mb-1">Most Ordered</p>
                <p className="font-bold text-sm text-gray-900 leading-tight">Pyramid Baklawa</p>
              </div>
            </div>
          </section>

          {/* AI QUICK ORDER (Enlarged) */}
          <button
            onClick={() => setIsAiModalOpen(true)}
            className="w-full bg-gradient-to-r from-[#C5A059] to-[#D4AF37] text-white p-6 md:p-8 rounded-2xl flex items-center justify-between shadow-[0_8px_30px_-4px_rgba(197,160,89,0.3)] hover:shadow-[0_12px_40px_-4px_rgba(197,160,89,0.4)] transition-all relative overflow-hidden group text-left"
          >
            <div className="absolute inset-0 bg-[url('https://www.transparenttextures.com/patterns/cubes.png')] opacity-10"></div>
            <div className="relative z-10">
              <h3 className="text-xl md:text-2xl font-serif font-bold flex items-center gap-3 mb-2">
                <Sparkles size={24} className="animate-pulse" /> Quick Order via AI
              </h3>
              <p className="text-xs md:text-sm text-white/90 font-medium">
                Type or paste a Purchase Order. Our engine instantly builds your wholesale cart.
              </p>
            </div>
            <div className="relative z-10 bg-white/20 p-3 rounded-full backdrop-blur-sm group-hover:translate-x-2 transition-transform">
              <ArrowRight size={24} />
            </div>
          </button>

          {/* 6 QUICK TOOLS GRID */}
          <div className="grid grid-cols-3 md:grid-cols-6 gap-3">
            {QUICK_TOOLS.map((tool, idx) => (
              <div
                key={idx}
                onClick={() => navigate(tool.path)}
                className="bg-white rounded-2xl shadow-[0_4px_15px_-3px_rgba(0,0,0,0.05)] p-4 flex flex-col items-center justify-center aspect-square gap-3 cursor-pointer hover:-translate-y-1 hover:shadow-lg hover:border-[#C5A059]/30 transition-all border border-transparent"
              >
                <tool.icon size={28} strokeWidth={1.5} className="text-[#C5A059]" />
                <span className="text-[10px] md:text-xs font-bold text-gray-700 text-center uppercase tracking-wider leading-tight">
                  {tool.label}
                </span>
              </div>
            ))}
          </div>

          {/* ACTIONS */}
          <section className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <button className="bg-[#1A1A1A] text-white p-5 rounded-2xl flex items-center justify-between shadow-md hover:bg-black transition-colors">
              <div className="text-left">
                <p className="font-bold text-sm">Download Docs</p>
                <p className="text-[11px] text-gray-400">Invoices & E-Way Bills</p>
              </div>
              <Download size={20} className="text-[#C5A059]" />
            </button>
            <button className="bg-white border border-gray-200 text-gray-900 p-5 rounded-2xl flex items-center justify-between shadow-sm hover:bg-gray-50 transition-colors">
              <div className="text-left">
                <p className="font-bold text-sm">Raise Ticket</p>
                <p className="text-[11px] text-gray-500">Support & Complaints</p>
              </div>
              <Ticket size={20} className="text-[#EF4444]" />
            </button>
          </section>

          {/* LIVE ORDER TRACKER */}
          <section className="pb-12">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-sm font-bold text-gray-900 uppercase tracking-widest flex items-center gap-2">
                <Clock size={16} className="text-[#C5A059]" /> Live Order Tracker
              </h2>
              <button onClick={() => navigate("/orders")} className="text-xs font-bold text-[#C5A059] hover:underline">
                View All
              </button>
            </div>

            {latestOrder ? (
              <div className="bg-white rounded-[2rem] border border-gray-100 shadow-[0_4px_20px_-4px_rgba(0,0,0,0.05)] overflow-hidden">
                <div className="bg-gray-50/50 border-b border-gray-100 p-6 flex justify-between items-center">
                  <div>
                    <p className="text-[10px] text-gray-500 font-bold uppercase tracking-widest mb-1">
                      SO #{latestOrder.id.split("-")[0].toUpperCase()}
                    </p>
                    <p className="font-black text-xl text-gray-900">
                      {formatPrice(latestOrder.sales_order_value || 0)}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="text-[10px] text-gray-500 font-bold mb-1">Placed On</p>
                    <p className="text-xs font-bold text-gray-900">{formatDate(latestOrder.created_at)}</p>
                  </div>
                </div>

                <div className="p-8 relative">
                  <div className="absolute left-12 top-12 bottom-12 w-[2px] bg-gray-100"></div>

                  <div className="relative flex items-start gap-5 mb-10">
                    <div
                      className={`w-10 h-10 rounded-full flex items-center justify-center shrink-0 z-10 ${getTimelineStep(latestOrder) >= 1 ? "bg-[#10B981] text-white shadow-lg shadow-[#10B981]/20" : "bg-gray-100 text-gray-400"}`}
                    >
                      <span className="font-bold">1</span>
                    </div>
                    <div className="flex-1 pt-2">
                      <h4 className="font-bold text-gray-900 text-base">Order Logged</h4>

                      {/* ACTION BOX: Advance Receipt */}
                      {latestOrder.payment_status === "awaiting_receipt" ? (
                        <div className="mt-4 bg-[#FDFCF8] border border-[#C5A059]/30 rounded-xl p-4 shadow-sm">
                          <p className="text-xs font-bold text-[#C5A059] flex items-center gap-1.5 mb-2">
                            <AlertTriangle size={14} /> Action Required
                          </p>
                          <p className="text-[11px] text-gray-600 mb-4 font-medium">
                            Please transfer the 50% advance and upload the payment receipt to release this to
                            Production.
                          </p>
                          <button
                            onClick={() => setUtrModal({ isOpen: true, orderId: latestOrder.id, type: "advance" })}
                            className="w-full py-2.5 bg-[#C5A059] text-white rounded-xl text-xs font-bold shadow-md hover:bg-[#B38F48] flex justify-center items-center gap-2 transition-colors"
                          >
                            <UploadCloud size={14} /> Upload Advance Receipt
                          </button>
                        </div>
                      ) : (
                        <p className="text-xs text-gray-500 font-medium mt-1">
                          Financials verified. Released to Production.
                        </p>
                      )}
                    </div>
                  </div>

                  <div className="relative flex items-start gap-5 mb-10">
                    <div
                      className={`w-10 h-10 rounded-full flex items-center justify-center shrink-0 z-10 transition-colors ${getTimelineStep(latestOrder) >= 2 ? "bg-[#C5A059] text-white shadow-lg shadow-[#C5A059]/20" : "bg-white border-2 border-gray-200 text-gray-400"}`}
                    >
                      <span className="font-bold">2</span>
                    </div>
                    <div className="flex-1 pt-2">
                      <h4
                        className={`font-bold text-base ${getTimelineStep(latestOrder) >= 2 ? "text-gray-900" : "text-gray-400"}`}
                      >
                        Production & Assembly
                      </h4>
                      {getTimelineStep(latestOrder) === 2 && (
                        <p className="text-xs text-[#C5A059] font-bold mt-1 flex items-center gap-1">
                          <Loader2 size={12} className="animate-spin" /> Packaging division is assembling your master
                          cartons
                        </p>
                      )}
                    </div>
                  </div>

                  <div className="relative flex items-start gap-5 mb-10">
                    <div
                      className={`w-10 h-10 rounded-full flex items-center justify-center shrink-0 z-10 transition-colors ${getTimelineStep(latestOrder) >= 3 ? "bg-[#3B82F6] text-white shadow-lg shadow-[#3B82F6]/20" : "bg-white border-2 border-gray-200 text-gray-400"}`}
                    >
                      <span className="font-bold">3</span>
                    </div>
                    <div className="flex-1 pt-2">
                      <h4
                        className={`font-bold text-base ${getTimelineStep(latestOrder) >= 3 ? "text-gray-900" : "text-gray-400"}`}
                      >
                        Final Invoicing
                      </h4>

                      {/* ACTION BOX: Final Receipt */}
                      {latestOrder.status === "awaiting_final_payment" && (
                        <div className="mt-4 bg-[#F8FAFC] border border-[#3B82F6]/30 rounded-xl p-4 shadow-sm">
                          <p className="text-xs font-bold text-[#3B82F6] flex items-center gap-1.5 mb-2">
                            <AlertTriangle size={14} /> Final Payment Required
                          </p>
                          <p className="text-[11px] text-gray-600 mb-4 font-medium">
                            Finance has generated the final tax invoice based on actual packed weights. Please clear the
                            balance.
                          </p>
                          <div className="flex gap-2">
                            <button className="flex-1 py-2 bg-white border border-gray-200 text-gray-700 rounded-lg text-[10px] font-bold shadow-sm flex justify-center items-center gap-1 hover:bg-gray-50">
                              <FileText size={12} /> View Invoice
                            </button>
                            <button
                              onClick={() => setUtrModal({ isOpen: true, orderId: latestOrder.id, type: "final" })}
                              className="flex-1 py-2 bg-[#3B82F6] text-white rounded-lg text-[10px] font-bold shadow-md hover:bg-[#2563EB] flex justify-center items-center gap-1"
                            >
                              <UploadCloud size={12} /> Upload Final Receipt
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="relative flex items-start gap-5">
                    <div
                      className={`w-10 h-10 rounded-full flex items-center justify-center shrink-0 z-10 transition-colors ${getTimelineStep(latestOrder) >= 4 ? "bg-[#1A1A1A] text-white shadow-lg shadow-black/20" : "bg-white border-2 border-gray-200 text-gray-400"}`}
                    >
                      <Truck size={18} />
                    </div>
                    <div className="flex-1 pt-2">
                      <h4
                        className={`font-bold text-base ${getTimelineStep(latestOrder) >= 4 ? "text-gray-900" : "text-gray-400"}`}
                      >
                        Dispatched
                      </h4>
                      {getTimelineStep(latestOrder) >= 4 && (
                        <div className="mt-4 flex gap-3">
                          <button className="flex-1 py-2.5 bg-white border border-gray-200 text-gray-700 rounded-xl text-xs font-bold shadow-sm hover:shadow-md flex items-center justify-center gap-2 transition-all">
                            <Download size={14} className="text-[#C5A059]" /> LR Copy / WayBill
                          </button>
                          <button className="flex-1 py-2.5 bg-[#1A1A1A] text-white rounded-xl text-xs font-bold shadow-md hover:bg-black flex items-center justify-center gap-2 transition-all">
                            <Headphones size={14} /> Logistics Support
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            ) : (
              <div className="bg-white rounded-[2rem] border border-gray-100 p-10 text-center shadow-[0_4px_20px_-4px_rgba(0,0,0,0.05)]">
                <Package size={40} className="mx-auto text-gray-300 mb-4" />
                <p className="text-gray-500 text-sm font-medium mb-5">No active shipments in transit.</p>
                <button
                  onClick={() => navigate("/catalogue")}
                  className="px-6 py-2.5 bg-[#C5A059] text-white rounded-xl font-bold text-xs shadow-md hover:bg-[#B38F48] transition-colors"
                >
                  Start New Order
                </button>
              </div>
            )}
          </section>
        </main>
      </div>

      {/* UPLOAD MODAL (AnimatePresence) */}
      <AnimatePresence>
        {utrModal.isOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4 backdrop-blur-sm">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-white rounded-3xl p-6 md:p-8 w-full max-w-sm shadow-2xl border border-gray-100"
            >
              <div className="flex justify-between items-center mb-6">
                <h3 className="font-serif text-xl font-bold text-gray-900">Upload Receipt</h3>
                <button
                  onClick={() => setUtrModal({ isOpen: false, orderId: null, type: "advance" })}
                  className="w-8 h-8 bg-gray-50 rounded-full flex items-center justify-center text-gray-500 hover:bg-gray-100 hover:text-gray-900 transition-colors"
                >
                  <X size={16} />
                </button>
              </div>

              <div className="space-y-5">
                <label className="bg-[#FDFCF8] p-5 border-2 border-dashed border-[#C5A059]/30 rounded-2xl flex flex-col items-center justify-center text-center cursor-pointer hover:border-[#C5A059] hover:bg-[#C5A059]/5 transition-all relative">
                  <input
                    type="file"
                    accept="image/*,.pdf"
                    className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                    onChange={(e) => setSelectedFile(e.target.files?.[0] || null)}
                  />
                  <UploadCloud size={32} className={selectedFile ? "text-[#C5A059] mb-3" : "text-gray-300 mb-3"} />
                  <p className="text-sm font-bold text-gray-700">
                    {selectedFile ? selectedFile.name : "Tap to browse files"}
                  </p>
                  <p className="text-[10px] text-gray-400 mt-1.5 uppercase tracking-wider">JPG, PNG, PDF</p>
                </label>

                <div>
                  <label className="block text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-2">
                    Bank Reference No. / Transaction ID
                  </label>
                  <input
                    type="text"
                    placeholder="e.g., REF1234567890"
                    value={utrRef}
                    onChange={(e) => setUtrRef(e.target.value)}
                    className="w-full bg-white border border-gray-200 rounded-xl p-3 text-sm font-bold outline-none focus:border-[#C5A059] focus:ring-1 focus:ring-[#C5A059] transition-all"
                  />
                </div>
              </div>

              <button
                onClick={handleUploadReceipt}
                disabled={isUploading || !utrRef || !selectedFile}
                className="w-full mt-8 py-3.5 bg-[#1A1A1A] text-white font-bold rounded-xl hover:bg-black flex justify-center items-center gap-2 shadow-lg disabled:opacity-50 transition-all text-sm"
              >
                {isUploading ? <Loader2 size={16} className="animate-spin" /> : "Submit for Verification"}
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
