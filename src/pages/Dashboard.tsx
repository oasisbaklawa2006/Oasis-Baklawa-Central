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
import { useLanguage } from "@/contexts/LanguageContext";
import { useCurrency } from "@/contexts/CurrencyContext";

const formatDate = (dateString: string) =>
  new Date(dateString).toLocaleDateString("en-IN", {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });

const GOLD = "#c58B07";
const CHARCOAL = "#2A2A2A";

const Dashboard = () => {
  const navigate = useNavigate();
  const { t } = useLanguage();
  const { formatPrice } = useCurrency();
  const [orders, setOrders] = useState<any[]>([]);
  const [companyName, setCompanyName] = useState("");
  const [companyId, setCompanyId] = useState<string | null>(null);
  const [walletBalance, setWalletBalance] = useState(0);
  const [isApproved, setIsApproved] = useState(true);
  const [isAiModalOpen, setIsAiModalOpen] = useState(false);

  const [utrModal, setUtrModal] = useState<{ isOpen: boolean; orderId: string | null; type: "advance" | "final" }>({
    isOpen: false,
    orderId: null,
    type: "advance",
  });
  const [utrRef, setUtrRef] = useState("");
  const [isUploading, setIsUploading] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);

  const fetchDashboardData = async () => {
    const {
      data: { session },
    } = await supabase.auth.getSession();
    if (!session?.user) return;
    const uid = session.user.id;

    const { data: profile } = await supabase
      .from("profiles")
      .select("is_approved, full_name, company_id")
      .eq("id", uid)
      .maybeSingle();

    const { data: userRow } = await supabase.from("users").select("company_id, role").eq("id", uid).maybeSingle();

    const resolvedCompanyId = profile?.company_id || userRow?.company_id || null;
    setCompanyId(resolvedCompanyId);
    setIsApproved(profile?.is_approved === true);

    // IDENTITY FIX: Fetch business_name from companies, fallback to full_name, NEVER email
    let resolvedName = "";
    if (resolvedCompanyId) {
      const { data: company } = await supabase
        .from("companies")
        .select("business_name, wallet_balance, current_balance")
        .eq("id", resolvedCompanyId)
        .maybeSingle();
      if (company?.business_name) resolvedName = company.business_name;
      setWalletBalance(company?.wallet_balance || company?.current_balance || 0);
    }

    if (!resolvedName) {
      const { data: app } = await supabase
        .from("b2b_applications")
        .select("business_name")
        .eq("user_id", uid)
        .maybeSingle();
      if (app?.business_name) resolvedName = app.business_name;
      else resolvedName = profile?.full_name || "Partner";
    }
    setCompanyName(resolvedName);

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
  const hasAwaitingAdvance = activeOrders.some((o) => o.payment_status === "awaiting_advance" || o.payment_status === "awaiting_receipt");
  const latestOrder = activeOrders[0];

  const getTimelineStep = (order: any) => {
    if (order.status === "dispatched") return 4;
    if (order.status === "awaiting_final_payment" || order.status === "cleared_for_dispatch") return 3;
    if (order.status === "in_production" || order.status === "packed_ready") return 2;
    return 1;
  };

  const needsAdvanceUpload = (order: any) =>
    order.payment_status === "awaiting_advance" || order.payment_status === "awaiting_receipt";

  const QUICK_TOOLS = [
    { icon: Package, label: t("dash.productCatalogue"), path: "/catalogue" },
    { icon: ListOrdered, label: t("dash.myOrders"), path: "/orders" },
    { icon: Building2, label: t("dash.buyerPortal"), path: "/buyer-portal" },
    { icon: FileText, label: t("dash.documents"), path: "/documents" },
    { icon: Star, label: t("dash.favorites"), path: "/favourites" },
    { icon: User, label: t("dash.myAccount"), path: "/account" },
  ];

  return (
    <AppShell>
      {/* MARQUEE */}
      <div className="bg-[#c58B07]/10 text-xs font-bold py-2.5 overflow-hidden relative flex items-center z-30 border-b border-[#c58B07]/15">
        <div className="absolute left-4 z-10 bg-background pr-3">
          <Megaphone size={14} style={{ color: GOLD }} />
        </div>
        <div className="whitespace-nowrap animate-[marquee_15s_linear_infinite] ml-12" style={{ color: GOLD }}>
          Welcome to the new Oasis B2B Portal! • Dispatch SLAs are currently 48 hours from advance payment • Festive
          Pre-Booking opens next week! • Contact support for volume discounts.
        </div>
      </div>
      <style>{`@keyframes marquee { 0% { transform: translateX(100%); } 100% { transform: translateX(-100%); } }`}</style>

      <div className="min-h-screen bg-background font-sans pb-24">
        <main className="px-4 sm:px-6 max-w-5xl mx-auto space-y-8">
          {/* KPIs */}
          <section>
            <h1 className="font-serif text-3xl font-bold text-foreground tracking-tight">
              {t("dash.welcomeBack")} {companyName}
            </h1>
            <p className="text-sm font-medium text-muted-foreground mt-1 mb-6">{t("dash.businessOverview")}</p>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              {/* Total Business */}
              <div className="bg-card p-6 rounded-2xl border-2 border-[#c58B07]/25 hover:border-[#c58B07]/50 transition-colors shadow-sm">
                <TrendingUp size={14} style={{ color: GOLD }} className="mb-3" />
                <p className="text-[10px] text-muted-foreground font-semibold uppercase tracking-[0.15em] mb-1">
                  {t("dash.totalBusiness")}
                </p>
                <p className="font-bold text-2xl lg:text-3xl font-number" style={{ color: GOLD }}>
                  {formatPrice(totalBusiness || 0)}
                </p>
              </div>
              {/* Active Orders */}
              <div className={`bg-card p-6 rounded-2xl border-2 transition-colors shadow-sm ${hasAwaitingAdvance ? "border-orange-400 animate-pulse" : "border-[#c58B07]/25 hover:border-[#c58B07]/50"}`}>
                <Package size={14} style={{ color: hasAwaitingAdvance ? "#f97316" : GOLD }} className="mb-3" />
                <p className="text-[10px] text-muted-foreground font-semibold uppercase tracking-[0.15em] mb-1">
                  {t("dash.totalOrders")}
                </p>
                <p className="font-bold text-2xl lg:text-3xl text-foreground">
                  {activeOrders.length || 0} <span className="text-sm text-muted-foreground">Active</span>
                </p>
                {hasAwaitingAdvance && (
                  <span className="text-[10px] font-bold text-orange-500 mt-1 block">⚠ Advance Pending</span>
                )}
              </div>
              {/* Wallet Balance */}
              <div className="bg-card p-6 rounded-2xl border-2 border-[#c58B07]/25 hover:border-[#c58B07]/50 transition-colors shadow-sm">
                <IndianRupee size={14} style={{ color: GOLD }} className="mb-3" />
                <p className="text-[10px] text-muted-foreground font-semibold uppercase tracking-[0.15em] mb-1">
                  {t("dash.walletBalance")}
                </p>
                <p className="font-bold text-2xl lg:text-3xl text-foreground">
                  {formatPrice(walletBalance)}
                  <span className="text-[10px] font-medium text-muted-foreground block mt-0.5">
                    {walletBalance > 0 ? "Available" : t("dash.noPendingRefunds")}
                  </span>
                </p>
              </div>
              {/* Most Ordered */}
              <div className="bg-card p-6 rounded-2xl border-2 border-[#c58B07]/25 hover:border-[#c58B07]/50 transition-colors shadow-sm">
                <TrendingUp size={14} style={{ color: GOLD }} className="mb-3" />
                <p className="text-[10px] text-muted-foreground font-semibold uppercase tracking-[0.15em] mb-1">
                  {t("dash.mostOrdered")}
                </p>
                <p className="font-bold text-sm text-foreground leading-tight">—</p>
              </div>
            </div>
          </section>

          {/* AI QUICK ORDER */}
          <button
            onClick={() => setIsAiModalOpen(true)}
            className="w-full p-6 md:p-8 rounded-2xl flex items-center justify-between shadow-lg hover:shadow-xl transition-all relative overflow-hidden group text-left"
            style={{ background: `linear-gradient(135deg, ${GOLD}, #A67806)` }}
          >
            <div className="absolute inset-0 bg-[url('https://www.transparenttextures.com/patterns/cubes.png')] opacity-10"></div>
            <div className="relative z-10">
              <h3 className="text-xl md:text-2xl font-serif font-bold flex items-center gap-3 mb-2 text-white">
                <Sparkles size={24} className="animate-pulse" /> {t("dash.quickOrderAI")}
              </h3>
              <p className="text-xs md:text-sm text-white/70 font-medium">{t("dash.quickOrderSub")}</p>
            </div>
            <div className="relative z-10 bg-white/20 p-3 rounded-full backdrop-blur-sm group-hover:translate-x-2 transition-transform">
              <ArrowRight size={24} className="text-white" />
            </div>
          </button>

          {/* QUICK TOOLS */}
          <div className="grid grid-cols-3 md:grid-cols-6 gap-3">
            {QUICK_TOOLS.map((tool, idx) => (
              <div
                key={idx}
                onClick={() => navigate(tool.path)}
                className="group bg-card rounded-2xl p-4 flex flex-col items-center justify-center aspect-square gap-3 cursor-pointer hover:scale-[1.03] transition-all border border-border hover:border-[#c58B07]/30 shadow-sm"
              >
                <tool.icon
                  size={28}
                  strokeWidth={1.5}
                  style={{ color: GOLD }}
                  className="group-hover:scale-110 transition-transform"
                />
                <span className="text-[10px] md:text-xs font-bold text-muted-foreground group-hover:text-foreground text-center uppercase tracking-wider leading-tight transition-colors">
                  {tool.label}
                </span>
              </div>
            ))}
          </div>

          {/* ACTIONS */}
          <section className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <button
              onClick={() => navigate("/documents")}
              className="bg-card border border-border text-foreground p-5 rounded-2xl flex items-center justify-between hover:border-[#c58B07]/30 transition-all shadow-sm"
            >
              <div className="text-left">
                <p className="font-bold text-sm text-foreground">{t("dash.downloadDocs")}</p>
                <p className="text-[11px] text-muted-foreground">{t("dash.invoicesEway")}</p>
              </div>
              <Download size={20} style={{ color: GOLD }} />
            </button>
            <button className="bg-card border border-border text-foreground p-5 rounded-2xl flex items-center justify-between hover:border-destructive/30 transition-all shadow-sm">
              <div className="text-left">
                <p className="font-bold text-sm text-foreground">{t("dash.raiseTicket")}</p>
                <p className="text-[11px] text-muted-foreground">{t("dash.supportComplaints")}</p>
              </div>
              <Ticket size={20} className="text-destructive" />
            </button>
          </section>

          {/* LIVE ORDER TRACKER */}
          <section className="pb-12">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-sm font-bold text-foreground uppercase tracking-widest flex items-center gap-2">
                <Clock size={16} style={{ color: GOLD }} /> {t("dash.liveOrderTracker")}
              </h2>
              <button onClick={() => navigate("/orders")} className="text-xs font-bold hover:underline" style={{ color: GOLD }}>
                {t("dash.viewAll")}
              </button>
            </div>

            {latestOrder ? (
              <div className="bg-card rounded-[2rem] border border-border overflow-hidden shadow-sm">
                <div className="bg-muted/30 border-b border-border p-6 flex justify-between items-center">
                  <div>
                    <p className="text-[10px] text-muted-foreground font-bold uppercase tracking-widest mb-1 font-number">
                      SO #{latestOrder.id.split("-")[0].toUpperCase()}
                    </p>
                    <p className="font-bold text-xl font-number" style={{ color: GOLD }}>
                      {formatPrice(latestOrder.sales_order_value || 0)}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="text-[10px] text-muted-foreground font-bold mb-1">{t("dash.placedOn")}</p>
                    <p className="text-xs font-bold text-foreground">{formatDate(latestOrder.created_at)}</p>
                  </div>
                </div>

                <div className="p-8 relative">
                  <div className="absolute left-12 top-12 bottom-12 w-[2px] bg-border"></div>

                  {/* Step 1 */}
                  <div className="relative flex items-start gap-5 mb-10">
                    <div
                      className={`w-10 h-10 rounded-full flex items-center justify-center shrink-0 z-10 ${getTimelineStep(latestOrder) >= 1 ? "bg-emerald-500 text-white shadow-lg shadow-emerald-500/20" : "bg-muted text-muted-foreground"}`}
                    >
                      <span className="font-bold">1</span>
                    </div>
                    <div className="flex-1 pt-2">
                      <h4 className="font-bold text-foreground text-base">{t("dash.orderLogged")}</h4>
                      {needsAdvanceUpload(latestOrder) ? (
                        <div className="mt-4 bg-orange-50 dark:bg-orange-950/30 border border-orange-400/40 rounded-xl p-4">
                          <p className="text-xs font-bold flex items-center gap-1.5 mb-2 text-orange-600">
                            <AlertTriangle size={14} /> {t("dash.actionRequired")}
                          </p>
                          <p className="text-[11px] text-muted-foreground mb-4 font-medium">{t("dash.advanceTransferMsg")}</p>
                          <button
                            onClick={() => setUtrModal({ isOpen: true, orderId: latestOrder.id, type: "advance" })}
                            className="w-full py-3 text-white rounded-xl text-sm font-bold shadow-lg flex justify-center items-center gap-2 transition-colors animate-pulse"
                            style={{ backgroundColor: "#f97316" }}
                          >
                            <UploadCloud size={16} /> Upload Advance Receipt Now
                          </button>
                        </div>
                      ) : latestOrder.payment_status === "awaiting_receipt" ? (
                        <div className="mt-4 bg-muted border border-[#c58B07]/20 rounded-xl p-4">
                          <p className="text-xs font-bold flex items-center gap-1.5 mb-2" style={{ color: GOLD }}>
                            <AlertTriangle size={14} /> {t("dash.actionRequired")}
                          </p>
                          <p className="text-[11px] text-muted-foreground mb-4 font-medium">{t("dash.advanceTransferMsg")}</p>
                          <button
                            onClick={() => setUtrModal({ isOpen: true, orderId: latestOrder.id, type: "advance" })}
                            className="w-full py-2.5 text-white rounded-xl text-xs font-bold shadow-md flex justify-center items-center gap-2 transition-colors"
                            style={{ backgroundColor: GOLD }}
                          >
                            <UploadCloud size={14} /> {t("dash.uploadAdvanceReceipt")}
                          </button>
                        </div>
                      ) : (
                        <p className="text-xs text-muted-foreground font-medium mt-1">{t("dash.financialsVerified")}</p>
                      )}
                    </div>
                  </div>

                  {/* Step 2 */}
                  <div className="relative flex items-start gap-5 mb-10">
                    <div
                      className={`w-10 h-10 rounded-full flex items-center justify-center shrink-0 z-10 transition-colors ${getTimelineStep(latestOrder) >= 2 ? "text-white shadow-lg" : "bg-muted border border-border text-muted-foreground"}`}
                      style={getTimelineStep(latestOrder) >= 2 ? { backgroundColor: GOLD } : {}}
                    >
                      <span className="font-bold">2</span>
                    </div>
                    <div className="flex-1 pt-2">
                      <h4
                        className={`font-bold text-base ${getTimelineStep(latestOrder) >= 2 ? "text-foreground" : "text-muted-foreground"}`}
                      >
                        {t("dash.productionAssembly")}
                      </h4>
                      {getTimelineStep(latestOrder) === 2 && (
                        <p className="text-xs font-bold mt-1 flex items-center gap-1" style={{ color: GOLD }}>
                          <Loader2 size={12} className="animate-spin" /> {t("dash.packagingAssembling")}
                        </p>
                      )}
                    </div>
                  </div>

                  {/* Step 3 */}
                  <div className="relative flex items-start gap-5 mb-10">
                    <div
                      className={`w-10 h-10 rounded-full flex items-center justify-center shrink-0 z-10 transition-colors ${getTimelineStep(latestOrder) >= 3 ? "bg-blue-500 text-white shadow-lg shadow-blue-500/20" : "bg-muted border border-border text-muted-foreground"}`}
                    >
                      <span className="font-bold">3</span>
                    </div>
                    <div className="flex-1 pt-2">
                      <h4
                        className={`font-bold text-base ${getTimelineStep(latestOrder) >= 3 ? "text-foreground" : "text-muted-foreground"}`}
                      >
                        {t("dash.finalInvoicing")}
                      </h4>
                      {latestOrder.status === "awaiting_final_payment" && (
                        <div className="mt-4 bg-muted border border-blue-500/20 rounded-xl p-4">
                          <p className="text-xs font-bold text-blue-600 flex items-center gap-1.5 mb-2">
                            <AlertTriangle size={14} /> {t("dash.finalPaymentRequired")}
                          </p>
                          <p className="text-[11px] text-muted-foreground mb-4 font-medium">{t("dash.finalInvoiceMsg")}</p>
                          <div className="flex gap-2">
                            <button className="flex-1 py-2 bg-muted border border-border text-foreground rounded-lg text-[10px] font-bold flex justify-center items-center gap-1 hover:bg-muted/80">
                              <FileText size={12} /> {t("dash.viewInvoice")}
                            </button>
                            <button
                              onClick={() => setUtrModal({ isOpen: true, orderId: latestOrder.id, type: "final" })}
                              className="flex-1 py-2 bg-blue-500 text-white rounded-lg text-[10px] font-bold shadow-md hover:bg-blue-600 flex justify-center items-center gap-1"
                            >
                              <UploadCloud size={12} /> {t("dash.uploadFinalReceipt")}
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Step 4 */}
                  <div className="relative flex items-start gap-5">
                    <div
                      className={`w-10 h-10 rounded-full flex items-center justify-center shrink-0 z-10 transition-colors ${getTimelineStep(latestOrder) >= 4 ? "bg-foreground text-background shadow-lg" : "bg-muted border border-border text-muted-foreground"}`}
                    >
                      <Truck size={18} />
                    </div>
                    <div className="flex-1 pt-2">
                      <h4
                        className={`font-bold text-base ${getTimelineStep(latestOrder) >= 4 ? "text-foreground" : "text-muted-foreground"}`}
                      >
                        {t("dash.dispatched")}
                      </h4>
                      {getTimelineStep(latestOrder) >= 4 && (
                        <div className="mt-4 flex gap-3">
                          <button className="flex-1 py-2.5 bg-muted border border-border text-foreground rounded-xl text-xs font-bold hover:border-[#c58B07]/30 flex items-center justify-center gap-2 transition-all">
                            <Download size={14} style={{ color: GOLD }} /> {t("dash.lrCopyWaybill")}
                          </button>
                          <button
                            className="flex-1 py-2.5 text-white rounded-xl text-xs font-bold shadow-md flex items-center justify-center gap-2 transition-all"
                            style={{ backgroundColor: GOLD }}
                          >
                            <Headphones size={14} /> {t("dash.logisticsSupport")}
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            ) : (
              <div className="bg-card rounded-[2rem] border border-border p-10 text-center shadow-sm">
                <Package size={40} className="mx-auto text-muted-foreground mb-4" />
                <p className="text-muted-foreground text-sm font-medium mb-5">{t("dash.noActiveShipments")}</p>
                <button
                  onClick={() => navigate("/catalogue")}
                  className="px-6 py-2.5 text-white rounded-xl font-bold text-xs shadow-md transition-colors"
                  style={{ backgroundColor: GOLD }}
                >
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
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-card rounded-3xl p-6 md:p-8 w-full max-w-sm shadow-2xl border border-border"
            >
              <div className="flex justify-between items-center mb-6">
                <h3 className="font-serif text-xl font-bold text-foreground">{t("dash.uploadReceipt")}</h3>
                <button
                  onClick={() => setUtrModal({ isOpen: false, orderId: null, type: "advance" })}
                  className="w-8 h-8 bg-muted rounded-full flex items-center justify-center text-muted-foreground hover:text-foreground transition-colors"
                >
                  <X size={16} />
                </button>
              </div>
              <div className="space-y-5">
                <label className="bg-background p-5 border-2 border-dashed border-[#c58B07]/20 rounded-2xl flex flex-col items-center justify-center text-center cursor-pointer hover:border-[#c58B07]/50 transition-all relative">
                  <input
                    type="file"
                    accept="image/*,.pdf"
                    className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                    onChange={(e) => setSelectedFile(e.target.files?.[0] || null)}
                  />
                  <UploadCloud size={32} className={selectedFile ? "mb-3" : "text-muted-foreground mb-3"} style={selectedFile ? { color: GOLD } : {}} />
                  <p className="text-sm font-bold text-foreground">
                    {selectedFile ? selectedFile.name : "Tap to browse files"}
                  </p>
                  <p className="text-[10px] text-muted-foreground mt-1.5 uppercase tracking-wider">JPG, PNG, PDF</p>
                </label>
                <div>
                  <label className="block text-[10px] font-bold text-muted-foreground uppercase tracking-widest mb-2">
                    {t("dash.bankRefNo")}
                  </label>
                  <input
                    type="text"
                    placeholder="e.g., REF1234567890"
                    value={utrRef}
                    onChange={(e) => setUtrRef(e.target.value)}
                    className="w-full bg-muted border border-border rounded-xl p-3 text-sm font-bold text-foreground outline-none focus:border-[#c58B07] focus:ring-1 focus:ring-[#c58B07] transition-all placeholder:text-muted-foreground/50"
                  />
                </div>
              </div>
              <button
                onClick={handleUploadReceipt}
                disabled={isUploading || !utrRef || !selectedFile}
                className="w-full mt-8 py-3.5 text-white font-bold rounded-xl flex justify-center items-center gap-2 shadow-lg disabled:opacity-50 transition-all text-sm"
                style={{ backgroundColor: GOLD }}
              >
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
