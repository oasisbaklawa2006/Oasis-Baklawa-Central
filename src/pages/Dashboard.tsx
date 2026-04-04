import AppShell from "@/components/AppShell";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import {
  Package, Clock, Truck, FileText, Ticket, TrendingUp, IndianRupee, Sparkles, ArrowRight,
  ListOrdered, Building2, Star, User, Download, Headphones, Megaphone, AlertTriangle,
  UploadCloud, X, Loader2, CheckCircle2, Receipt,
} from "lucide-react";
import { useNavigate } from "react-router-dom";
import AiOrderModal from "@/components/AiOrderModal";
import { motion, AnimatePresence } from "framer-motion";
import { toast } from "sonner";
import { useLanguage } from "@/contexts/LanguageContext";
import { useCurrency } from "@/contexts/CurrencyContext";

const formatDate = (dateString: string) =>
  new Date(dateString).toLocaleDateString("en-IN", {
    day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit",
  });

const Dashboard = () => {
  const navigate = useNavigate();
  const { t } = useLanguage();
  const { formatPrice } = useCurrency();
  const [orders, setOrders] = useState<any[]>([]);
  const [companyName, setCompanyName] = useState("");
  const [companyId, setCompanyId] = useState<string | null>(null);
  const [isApproved, setIsApproved] = useState(true);
  const [isAiModalOpen, setIsAiModalOpen] = useState(false);

  const [utrModal, setUtrModal] = useState<{ isOpen: boolean; orderId: string | null; type: "advance" | "final" }>({
    isOpen: false, orderId: null, type: "advance",
  });
  const [utrRef, setUtrRef] = useState("");
  const [isUploading, setIsUploading] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);

  const fetchDashboardData = async () => {
    // 1. Get authenticated user
    const { data: { session } } = await supabase.auth.getSession();
    if (!session?.user) return;
    const uid = session.user.id;

    // 2. Get profile for status & company linkage
    const { data: profile } = await supabase
      .from("profiles")
      .select("is_approved, full_name, company_id")
      .eq("id", uid)
      .maybeSingle();

    // 3. Get user record for company_id fallback
    const { data: userRow } = await supabase
      .from("users")
      .select("company_id, role")
      .eq("id", uid)
      .maybeSingle();

    const resolvedCompanyId = profile?.company_id || userRow?.company_id || null;
    setCompanyId(resolvedCompanyId);
    setIsApproved(profile?.is_approved === true);

    // 4. Get business name from company or b2b_applications
    if (resolvedCompanyId) {
      const { data: company } = await supabase
        .from("companies")
        .select("business_name")
        .eq("id", resolvedCompanyId)
        .maybeSingle();
      if (company?.business_name) setCompanyName(company.business_name);
    }

    if (!companyName) {
      // Fallback: try b2b_applications
      const { data: app } = await supabase
        .from("b2b_applications")
        .select("business_name")
        .eq("user_id", uid)
        .maybeSingle();
      if (app?.business_name) setCompanyName(app.business_name);
      else setCompanyName(profile?.full_name || session.user.email || "");
    }

    // 5. Fetch ONLY this user's company orders (RLS enforced + client-side filter)
    if (!resolvedCompanyId) {
      setOrders([]);
      return;
    }

    const { data } = await supabase
      .from("orders")
      .select("*, company:companies(business_name), order_items(*, product:products(name))")
      .eq("company_id", resolvedCompanyId)
      .order("created_at", { ascending: false });
    if (data) setOrders(data);
  };

  useEffect(() => { fetchDashboardData(); }, []);

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
      const { error: updateError } = await supabase.from("orders").update({ payment_status: nextPaymentStatus }).eq("id", utrModal.orderId);
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
    { icon: Package, label: t("dash.productCatalogue"), path: "/catalogue" },
    { icon: ListOrdered, label: t("dash.myOrders"), path: "/orders" },
    { icon: Building2, label: t("dash.buyerPortal"), path: "/buyer-portal" },
    { icon: FileText, label: t("dash.documents"), path: "/documents" },
    { icon: Star, label: t("dash.favorites"), path: "/favourites" },
    { icon: User, label: t("dash.myAccount"), path: "/account" },
  ];

  // Dark luxury color constants
  const BG = "#121212";
  const CARD = "#1E1E1E";
  const GOLD = "#D4AF37";
  const MUTED = "#9CA3AF";
  const BORDER = "border-white/[0.06]";

  return (
    <AppShell>
      {/* MARQUEE */}
      <div className={`bg-[${GOLD}]/10 text-[${GOLD}] text-xs font-bold py-2.5 overflow-hidden relative flex items-center z-30 border-b border-[${GOLD}]/10`}>
        <div className={`absolute left-4 z-10 bg-[#121212] pr-3`}><Megaphone size={14} className="text-[#D4AF37]" /></div>
        <div className="whitespace-nowrap animate-[marquee_15s_linear_infinite] ml-12 text-[#D4AF37]">
          Welcome to the new Oasis B2B Portal! • Dispatch SLAs are currently 48 hours from advance payment • Festive Pre-Booking opens next week! • Contact support for volume discounts.
        </div>
      </div>
      <style>{`@keyframes marquee { 0% { transform: translateX(100%); } 100% { transform: translateX(-100%); } }`}</style>

      <div className="min-h-screen bg-[#121212] font-sans pb-24">
        <main className="px-4 sm:px-6 max-w-5xl mx-auto space-y-8">
          {/* KPIs */}
          <section>
            <h1 className="font-serif text-3xl font-bold text-white tracking-tight">{t("dash.welcomeBack")} {companyName}</h1>
            <p className="text-sm font-medium text-[#9CA3AF] mt-1 mb-6">{t("dash.businessOverview")}</p>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="bg-[#1E1E1E] p-6 rounded-2xl border border-white/[0.06] hover:border-[#D4AF37]/20 transition-colors">
                <TrendingUp size={14} className="text-[#D4AF37] mb-3" />
                <p className="text-[10px] text-[#9CA3AF] font-semibold uppercase tracking-[0.15em] mb-1">{t("dash.totalBusiness")}</p>
                <p className="font-bold text-2xl lg:text-3xl text-[#D4AF37]" style={{ fontFamily: "'DM Sans', sans-serif" }}>{formatPrice(totalBusiness || 0)}</p>
              </div>
              <div className="bg-[#1E1E1E] p-6 rounded-2xl border border-white/[0.06] hover:border-[#D4AF37]/20 transition-colors">
                <Package size={14} className="text-[#D4AF37] mb-3" />
                <p className="text-[10px] text-[#9CA3AF] font-semibold uppercase tracking-[0.15em] mb-1">{t("dash.totalOrders")}</p>
                <p className="font-bold text-2xl lg:text-3xl text-white">{orders.length || 0} <span className="text-sm text-[#9CA3AF]">{t("dash.batches")}</span></p>
              </div>
              <div className="bg-[#1E1E1E] p-6 rounded-2xl border border-white/[0.06] hover:border-[#D4AF37]/20 transition-colors">
                <IndianRupee size={14} className="text-[#D4AF37] mb-3" />
                <p className="text-[10px] text-[#9CA3AF] font-semibold uppercase tracking-[0.15em] mb-1">{t("dash.walletBalance")}</p>
                <p className="font-bold text-2xl lg:text-3xl text-white">₹0 <span className="text-[10px] font-medium text-[#9CA3AF] block mt-0.5">{t("dash.noPendingRefunds")}</span></p>
              </div>
              <div className="bg-[#1E1E1E] p-6 rounded-2xl border border-white/[0.06] hover:border-[#D4AF37]/20 transition-colors">
                <TrendingUp size={14} className="text-[#D4AF37] mb-3" />
                <p className="text-[10px] text-[#9CA3AF] font-semibold uppercase tracking-[0.15em] mb-1">{t("dash.mostOrdered")}</p>
                <p className="font-bold text-sm text-white leading-tight">—</p>
              </div>
            </div>
          </section>

          {/* AI QUICK ORDER */}
          <button
            onClick={() => setIsAiModalOpen(true)}
            className="w-full bg-gradient-to-r from-[#D4AF37] to-[#B8962E] text-[#121212] p-6 md:p-8 rounded-2xl flex items-center justify-between shadow-[0_8px_30px_-4px_rgba(212,175,55,0.25)] hover:shadow-[0_12px_40px_-4px_rgba(212,175,55,0.35)] transition-all relative overflow-hidden group text-left"
          >
            <div className="absolute inset-0 bg-[url('https://www.transparenttextures.com/patterns/cubes.png')] opacity-10"></div>
            <div className="relative z-10">
              <h3 className="text-xl md:text-2xl font-serif font-bold flex items-center gap-3 mb-2">
                <Sparkles size={24} className="animate-pulse" /> {t("dash.quickOrderAI")}
              </h3>
              <p className="text-xs md:text-sm text-[#121212]/70 font-medium">{t("dash.quickOrderSub")}</p>
            </div>
            <div className="relative z-10 bg-[#121212]/20 p-3 rounded-full backdrop-blur-sm group-hover:translate-x-2 transition-transform">
              <ArrowRight size={24} />
            </div>
          </button>

          {/* QUICK TOOLS */}
          <div className="grid grid-cols-3 md:grid-cols-6 gap-3">
            {QUICK_TOOLS.map((tool, idx) => (
              <div key={idx} onClick={() => navigate(tool.path)} className="group bg-[#1E1E1E] rounded-2xl p-4 flex flex-col items-center justify-center aspect-square gap-3 cursor-pointer hover:scale-[1.03] hover:border-[#D4AF37]/30 transition-all border border-white/[0.06]">
                <tool.icon size={28} strokeWidth={1.5} className="text-[#D4AF37] group-hover:scale-110 transition-transform" />
                <span className="text-[10px] md:text-xs font-bold text-[#9CA3AF] group-hover:text-white text-center uppercase tracking-wider leading-tight transition-colors">{tool.label}</span>
              </div>
            ))}
          </div>

          {/* ACTIONS */}
          <section className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <button className="bg-[#1E1E1E] border border-white/[0.06] text-white p-5 rounded-2xl flex items-center justify-between hover:border-[#D4AF37]/30 transition-all">
              <div className="text-left">
                <p className="font-bold text-sm text-white">{t("dash.downloadDocs")}</p>
                <p className="text-[11px] text-[#9CA3AF]">{t("dash.invoicesEway")}</p>
              </div>
              <Download size={20} className="text-[#D4AF37]" />
            </button>
            <button className="bg-[#1E1E1E] border border-white/[0.06] text-white p-5 rounded-2xl flex items-center justify-between hover:border-red-500/30 transition-all">
              <div className="text-left">
                <p className="font-bold text-sm text-white">{t("dash.raiseTicket")}</p>
                <p className="text-[11px] text-[#9CA3AF]">{t("dash.supportComplaints")}</p>
              </div>
              <Ticket size={20} className="text-red-400" />
            </button>
          </section>

          {/* LIVE ORDER TRACKER */}
          <section className="pb-12">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-sm font-bold text-white uppercase tracking-widest flex items-center gap-2">
                <Clock size={16} className="text-[#D4AF37]" /> {t("dash.liveOrderTracker")}
              </h2>
              <button onClick={() => navigate("/orders")} className="text-xs font-bold text-[#D4AF37] hover:underline">{t("dash.viewAll")}</button>
            </div>

            {latestOrder ? (
              <div className="bg-[#1E1E1E] rounded-[2rem] border border-white/[0.06] overflow-hidden">
                <div className="bg-[#181818] border-b border-white/[0.06] p-6 flex justify-between items-center">
                  <div>
                    <p className="text-[10px] text-[#9CA3AF] font-bold uppercase tracking-widest mb-1">SO #{latestOrder.id.split("-")[0].toUpperCase()}</p>
                    <p className="font-bold text-xl text-[#D4AF37]">{formatPrice(latestOrder.sales_order_value || 0)}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-[10px] text-[#9CA3AF] font-bold mb-1">{t("dash.placedOn")}</p>
                    <p className="text-xs font-bold text-white">{formatDate(latestOrder.created_at)}</p>
                  </div>
                </div>

                <div className="p-8 relative">
                  <div className="absolute left-12 top-12 bottom-12 w-[2px] bg-white/[0.06]"></div>

                  {/* Step 1 */}
                  <div className="relative flex items-start gap-5 mb-10">
                    <div className={`w-10 h-10 rounded-full flex items-center justify-center shrink-0 z-10 ${getTimelineStep(latestOrder) >= 1 ? "bg-emerald-500 text-white shadow-lg shadow-emerald-500/20" : "bg-[#2A2A2A] text-[#9CA3AF]"}`}>
                      <span className="font-bold">1</span>
                    </div>
                    <div className="flex-1 pt-2">
                      <h4 className="font-bold text-white text-base">{t("dash.orderLogged")}</h4>
                      {latestOrder.payment_status === "awaiting_receipt" ? (
                        <div className="mt-4 bg-[#2A2A2A] border border-[#D4AF37]/20 rounded-xl p-4">
                          <p className="text-xs font-bold text-[#D4AF37] flex items-center gap-1.5 mb-2"><AlertTriangle size={14} /> {t("dash.actionRequired")}</p>
                          <p className="text-[11px] text-[#9CA3AF] mb-4 font-medium">{t("dash.advanceTransferMsg")}</p>
                          <button onClick={() => setUtrModal({ isOpen: true, orderId: latestOrder.id, type: "advance" })} className="w-full py-2.5 bg-[#D4AF37] text-[#121212] rounded-xl text-xs font-bold shadow-md hover:bg-[#C4A032] flex justify-center items-center gap-2 transition-colors">
                            <UploadCloud size={14} /> {t("dash.uploadAdvanceReceipt")}
                          </button>
                        </div>
                      ) : (
                        <p className="text-xs text-[#9CA3AF] font-medium mt-1">{t("dash.financialsVerified")}</p>
                      )}
                    </div>
                  </div>

                  {/* Step 2 */}
                  <div className="relative flex items-start gap-5 mb-10">
                    <div className={`w-10 h-10 rounded-full flex items-center justify-center shrink-0 z-10 transition-colors ${getTimelineStep(latestOrder) >= 2 ? "bg-[#D4AF37] text-[#121212] shadow-lg shadow-[#D4AF37]/20" : "bg-[#2A2A2A] border border-white/10 text-[#9CA3AF]"}`}>
                      <span className="font-bold">2</span>
                    </div>
                    <div className="flex-1 pt-2">
                      <h4 className={`font-bold text-base ${getTimelineStep(latestOrder) >= 2 ? "text-white" : "text-[#9CA3AF]"}`}>{t("dash.productionAssembly")}</h4>
                      {getTimelineStep(latestOrder) === 2 && (
                        <p className="text-xs text-[#D4AF37] font-bold mt-1 flex items-center gap-1"><Loader2 size={12} className="animate-spin" /> {t("dash.packagingAssembling")}</p>
                      )}
                    </div>
                  </div>

                  {/* Step 3 */}
                  <div className="relative flex items-start gap-5 mb-10">
                    <div className={`w-10 h-10 rounded-full flex items-center justify-center shrink-0 z-10 transition-colors ${getTimelineStep(latestOrder) >= 3 ? "bg-blue-500 text-white shadow-lg shadow-blue-500/20" : "bg-[#2A2A2A] border border-white/10 text-[#9CA3AF]"}`}>
                      <span className="font-bold">3</span>
                    </div>
                    <div className="flex-1 pt-2">
                      <h4 className={`font-bold text-base ${getTimelineStep(latestOrder) >= 3 ? "text-white" : "text-[#9CA3AF]"}`}>{t("dash.finalInvoicing")}</h4>
                      {latestOrder.status === "awaiting_final_payment" && (
                        <div className="mt-4 bg-[#2A2A2A] border border-blue-500/20 rounded-xl p-4">
                          <p className="text-xs font-bold text-blue-400 flex items-center gap-1.5 mb-2"><AlertTriangle size={14} /> {t("dash.finalPaymentRequired")}</p>
                          <p className="text-[11px] text-[#9CA3AF] mb-4 font-medium">{t("dash.finalInvoiceMsg")}</p>
                          <div className="flex gap-2">
                            <button className="flex-1 py-2 bg-[#2A2A2A] border border-white/10 text-white rounded-lg text-[10px] font-bold flex justify-center items-center gap-1 hover:border-white/20">
                              <FileText size={12} /> {t("dash.viewInvoice")}
                            </button>
                            <button onClick={() => setUtrModal({ isOpen: true, orderId: latestOrder.id, type: "final" })} className="flex-1 py-2 bg-blue-500 text-white rounded-lg text-[10px] font-bold shadow-md hover:bg-blue-600 flex justify-center items-center gap-1">
                              <UploadCloud size={12} /> {t("dash.uploadFinalReceipt")}
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Step 4 */}
                  <div className="relative flex items-start gap-5">
                    <div className={`w-10 h-10 rounded-full flex items-center justify-center shrink-0 z-10 transition-colors ${getTimelineStep(latestOrder) >= 4 ? "bg-white text-[#121212] shadow-lg shadow-white/10" : "bg-[#2A2A2A] border border-white/10 text-[#9CA3AF]"}`}>
                      <Truck size={18} />
                    </div>
                    <div className="flex-1 pt-2">
                      <h4 className={`font-bold text-base ${getTimelineStep(latestOrder) >= 4 ? "text-white" : "text-[#9CA3AF]"}`}>{t("dash.dispatched")}</h4>
                      {getTimelineStep(latestOrder) >= 4 && (
                        <div className="mt-4 flex gap-3">
                          <button className="flex-1 py-2.5 bg-[#2A2A2A] border border-white/10 text-white rounded-xl text-xs font-bold hover:border-[#D4AF37]/30 flex items-center justify-center gap-2 transition-all">
                            <Download size={14} className="text-[#D4AF37]" /> {t("dash.lrCopyWaybill")}
                          </button>
                          <button className="flex-1 py-2.5 bg-[#D4AF37] text-[#121212] rounded-xl text-xs font-bold shadow-md hover:bg-[#C4A032] flex items-center justify-center gap-2 transition-all">
                            <Headphones size={14} /> {t("dash.logisticsSupport")}
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            ) : (
              <div className="bg-[#1E1E1E] rounded-[2rem] border border-white/[0.06] p-10 text-center">
                <Package size={40} className="mx-auto text-[#9CA3AF] mb-4" />
                <p className="text-[#9CA3AF] text-sm font-medium mb-5">{t("dash.noActiveShipments")}</p>
                <button onClick={() => navigate("/catalogue")} className="px-6 py-2.5 bg-[#D4AF37] text-[#121212] rounded-xl font-bold text-xs shadow-md hover:bg-[#C4A032] transition-colors">
                  {t("dash.startNewOrder")}
                </button>
              </div>
            )}
          </section>
        </main>
      </div>

      {/* UPLOAD MODAL */}
      <AnimatePresence>
        {utrModal.isOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm">
            <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.95 }} className="bg-[#1E1E1E] rounded-3xl p-6 md:p-8 w-full max-w-sm shadow-2xl border border-white/[0.06]">
              <div className="flex justify-between items-center mb-6">
                <h3 className="font-serif text-xl font-bold text-white">{t("dash.uploadReceipt")}</h3>
                <button onClick={() => setUtrModal({ isOpen: false, orderId: null, type: "advance" })} className="w-8 h-8 bg-[#2A2A2A] rounded-full flex items-center justify-center text-[#9CA3AF] hover:bg-[#333] hover:text-white transition-colors"><X size={16} /></button>
              </div>
              <div className="space-y-5">
                <label className="bg-[#2A2A2A] p-5 border-2 border-dashed border-[#D4AF37]/20 rounded-2xl flex flex-col items-center justify-center text-center cursor-pointer hover:border-[#D4AF37]/50 transition-all relative">
                  <input type="file" accept="image/*,.pdf" className="absolute inset-0 w-full h-full opacity-0 cursor-pointer" onChange={(e) => setSelectedFile(e.target.files?.[0] || null)} />
                  <UploadCloud size={32} className={selectedFile ? "text-[#D4AF37] mb-3" : "text-[#9CA3AF] mb-3"} />
                  <p className="text-sm font-bold text-white">{selectedFile ? selectedFile.name : "Tap to browse files"}</p>
                  <p className="text-[10px] text-[#9CA3AF] mt-1.5 uppercase tracking-wider">JPG, PNG, PDF</p>
                </label>
                <div>
                  <label className="block text-[10px] font-bold text-[#9CA3AF] uppercase tracking-widest mb-2">{t("dash.bankRefNo")}</label>
                  <input type="text" placeholder="e.g., REF1234567890" value={utrRef} onChange={(e) => setUtrRef(e.target.value)} className="w-full bg-[#2A2A2A] border border-white/10 rounded-xl p-3 text-sm font-bold text-white outline-none focus:border-[#D4AF37] focus:ring-1 focus:ring-[#D4AF37] transition-all placeholder:text-[#9CA3AF]/50" />
                </div>
              </div>
              <button onClick={handleUploadReceipt} disabled={isUploading || !utrRef || !selectedFile} className="w-full mt-8 py-3.5 bg-[#D4AF37] text-[#121212] font-bold rounded-xl hover:bg-[#C4A032] flex justify-center items-center gap-2 shadow-lg disabled:opacity-50 transition-all text-sm">
                {isUploading ? <Loader2 size={16} className="animate-spin" /> : t("dash.submitVerification")}
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
