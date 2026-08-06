import AppShell from "@/components/AppShell";
import { useCallback, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { fetchAuthRoleRecord } from "@/lib/auth-routing";
import { generateSOPdf } from "@/utils/soGenerator";
import {
  Loader2,
  Package,
  Search,
  Download,
  AlertCircle,
  CheckCircle2,
  Ticket,
  Truck,
  RotateCcw,
  Upload,
  Receipt,
} from "lucide-react";
import { motion } from "framer-motion";
import { toast } from "sonner";
import SmartReorderModal from "@/components/SmartReorderModal";

const GOLD = "#c58B07";

const formatPrice = (n: number) => "₹" + n.toLocaleString("en-IN");
const formatDate = (dateString: string) =>
  new Date(dateString).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" });

const getDocStageLabel = (stage: string | null) => {
  switch (stage) {
    case "PI": return "Proforma Invoice";
    case "Final": return "Final Invoice Generated";
    default: return "Sales Order";
  }
};

const getDocStageStyle = (stage: string | null) => {
  switch (stage) {
    case "PI": return "bg-orange-50 text-orange-700 border-orange-100";
    case "Final": return "bg-emerald-50 text-emerald-700 border-emerald-100";
    default: return "bg-indigo-50 text-indigo-700 border-indigo-100";
  }
};

/** Safe for toast / console.error (never log raw tokens). */
function formatUploadDiag(prefix: string, err: unknown): string {
  const raw =
    err && typeof err === "object" && "message" in err && typeof (err as { message: unknown }).message === "string"
      ? (err as { message: string }).message
      : String(err ?? "unknown_error");
  return `${prefix}${raw.replace(/Bearer\s+\S+/gi, "[token]").slice(0, 400)}`;
}

type TimeFilter = "30days" | "6months" | "2026" | "all";

const Orders = () => {
  const navigate = useNavigate();
  const { user, companyId, profileReady } = useAuth();
  const [orders, setOrders] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploadingId, setUploadingId] = useState<string | null>(null);
  const [timeFilter, setTimeFilter] = useState<TimeFilter>("30days");
  const [searchQuery, setSearchQuery] = useState("");
  const [reorderOrder, setReorderOrder] = useState<any | null>(null);

  // Upload Receipt Modal state
  const [receiptModal, setReceiptModal] = useState<{ isOpen: boolean; orderId: string | null }>({ isOpen: false, orderId: null });
  const [receiptFile, setReceiptFile] = useState<File | null>(null);
  const [receiptRef, setReceiptRef] = useState("");
  const [isUploadingReceipt, setIsUploadingReceipt] = useState(false);

  const fetchOrders = useCallback(async () => {
    if (!user || !profileReady) return;

    setLoading(true);
    try {
      const authRecord = companyId ? null : await fetchAuthRoleRecord(user.id);
      const resolvedCompanyId = companyId || authRecord?.company_id || null;

      if (!resolvedCompanyId) {
        setOrders([]);
        return;
      }

      const { data, error } = await supabase
        .from("orders")
        .select(
          "id, status, payment_status, payment_receipt_url, payment_rejection_reason, created_at, actual_despatch_date, sales_order_value, document_stage, payment_cleared, eway_bill_number, proforma_invoice_url, final_invoice_url, eway_bill_url, company_id, advance_paid, advance_required, company:companies(business_name, gst_number), order_items(*, product:products(name, image_url, pack_size, carton_type, wholesale_price, mrp, price_per_kg, price_b2b, base_price, avg_weight_per_pack, net_weight_grams, gst_percentage, hsn_code, uom, category, sub_category, moq, packs_per_master_carton, pcs_per_master_carton))",
        )
        .eq("company_id", resolvedCompanyId)
        .in("status", ["submitted", "pending", "processing", "dispatched", "delivered", "cancelled"])
        .order("created_at", { ascending: false });

      if (error) throw error;
      setOrders(data ?? []);
    } catch (error) {
      console.error("[Orders] Failed to fetch company orders", error);
      setOrders([]);
    } finally {
      setLoading(false);
    }
  }, [companyId, profileReady, user]);

  useEffect(() => {
    if (!user || !profileReady) return;
    void fetchOrders();
  }, [fetchOrders, profileReady, user]);

  const handleDownloadDocument = (order: any) => {
    const stage = order.document_stage;
    if (stage === "Final") {
      if (order.final_invoice_url) window.open(order.final_invoice_url, "_blank");
      else toast.info("Final Invoice is being prepared by the accounts team.");
      return;
    }
    if (stage === "PI") {
      if (order.proforma_invoice_url) window.open(order.proforma_invoice_url, "_blank");
      else toast.info("Proforma Invoice is being prepared by the accounts team.");
      return;
    }
    generateSOPdf(order);
  };

  const handleUploadReceipt = async () => {
    if (!receiptRef || !receiptFile || !receiptModal.orderId) {
      toast.error("Please enter a reference number and attach a file.");
      return;
    }
    if (!user?.id) {
      toast.error("Your session expired. Sign in again to upload.");
      return;
    }
    setIsUploadingReceipt(true);
    const oid = receiptModal.orderId;
    const fileExt = receiptFile.name.split(".").pop();
    const fileName = `${oid}-${Date.now()}.${fileExt}`;
    let uploadedToStorage = false;

    try {
      const { error: uploadError } = await supabase.storage.from("receipts").upload(fileName, receiptFile, {
        upsert: false,
      });
      if (uploadError) {
        const diag = formatUploadDiag("Storage upload: ", uploadError);
        console.error("[Orders]", diag);
        toast.error("Could not upload file to receipts storage. Try again or use a smaller image/PDF.");
        return;
      }
      uploadedToStorage = true;

      const {
        data: { publicUrl },
      } = supabase.storage.from("receipts").getPublicUrl(fileName);

      const { error: updateError } = await supabase
        .from("orders")
        .update({ payment_receipt_url: publicUrl, payment_status: "under_review", payment_rejection_reason: null })
        .eq("id", oid);
      if (updateError) {
        const diag = formatUploadDiag("Orders update after receipt upload: ", updateError);
        console.error("[Orders]", diag);
        toast.error("Receipt file saved but the order could not be updated (permissions/network). Contact support.");
        await supabase.storage.from("receipts").remove([fileName]).catch(() => {});
        return;
      }

      const matchedOrder = orders.find((o) => o.id === oid);
      const payCompanyId = matchedOrder?.company_id ?? companyId ?? null;
      const payAmountRaw = matchedOrder?.advance_paid ?? matchedOrder?.advance_required ?? 0;
      const payAmount =
        typeof payAmountRaw === "number" ? payAmountRaw : Number(payAmountRaw) || 0;

      const { error: paymentInsertError } = await supabase.from("order_payments").insert({
        order_id: oid,
        company_id: payCompanyId,
        payment_type: "advance",
        amount: payAmount,
        payment_date: new Date().toISOString(),
        reference_no: receiptRef.trim(),
        proof_url: publicUrl,
        proof_storage_path: fileName,
        created_by: user.id,
        status: "under_review",
      });
      if (paymentInsertError) {
        const diag = formatUploadDiag("order_payments insert after receipt: ", paymentInsertError);
        console.error("[Orders]", diag);
        toast.error("Receipt attached but payment ledger row failed — reverting status; try again shortly.");
        await supabase
          .from("orders")
          .update({ payment_receipt_url: null, payment_status: "awaiting_receipt" })
          .eq("id", oid);
        await supabase.storage.from("receipts").remove([fileName]).catch(() => {});
        return;
      }

      toast.success("Payment receipt uploaded! Verification in progress.");
      setReceiptModal({ isOpen: false, orderId: null });
      setReceiptFile(null);
      setReceiptRef("");
      fetchOrders();
    } catch (error: unknown) {
      const diag = formatUploadDiag("Receipt upload unexpected: ", error);
      console.error("[Orders]", diag);
      toast.error("Receipt upload failed. Please try again.");
      if (uploadedToStorage) {
        await supabase.storage.from("receipts").remove([fileName]).catch(() => {});
      }
    } finally {
      setIsUploadingReceipt(false);
    }
  };

  const filteredOrders = orders.filter((order) => {
    const matchesSearch = order.id.toLowerCase().includes(searchQuery.toLowerCase());
    const orderDate = new Date(order.created_at);
    const now = new Date();
    const daysDiff = (now.getTime() - orderDate.getTime()) / (1000 * 3600 * 24);
    let matchesTime = true;
    if (timeFilter === "30days") matchesTime = daysDiff <= 30;
    if (timeFilter === "6months") matchesTime = daysDiff <= 180;
    if (timeFilter === "2026") matchesTime = orderDate.getFullYear() === 2026;
    return matchesSearch && matchesTime;
  });

  if (loading)
    return (
      <AppShell>
        <div className="flex flex-col items-center justify-center min-h-[60vh]">
          <Loader2 size={32} className="animate-spin" style={{ color: GOLD }} />
          <p className="mt-4 text-muted-foreground font-bold text-xs uppercase tracking-widest">Loading Ledger...</p>
        </div>
      </AppShell>
    );

  return (
    <AppShell>
      <div className="max-w-4xl mx-auto pb-24 px-4 sm:px-6 space-y-6">
        {/* HEADER */}
        <div>
          <h1 className="font-display text-3xl font-bold text-foreground">Order History</h1>
          <p className="text-sm font-bold text-muted-foreground mt-1">
            Review past shipments, download invoices, and track issues.
          </p>
        </div>

        {/* SEARCH & TABS */}
        <div className="space-y-4 sticky top-0 z-10 bg-background pt-2 pb-4">
          <div className="relative bg-card rounded-2xl shadow-sm border border-border p-2 flex items-center">
            <Search size={18} className="text-muted-foreground ml-3" />
            <input
              type="text"
              placeholder="Search by Order ID..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full bg-transparent border-none focus:ring-0 text-sm font-bold px-3 py-2 outline-none text-foreground"
            />
          </div>

          <div className="flex overflow-x-auto gap-2 scrollbar-hide pb-1">
            {[
              { id: "30days", label: "Last 30 Days" },
              { id: "6months", label: "Last 6 Months" },
              { id: "2026", label: "Year 2026" },
              { id: "all", label: "All Time" },
            ].map((tab) => (
              <button
                key={tab.id}
                onClick={() => setTimeFilter(tab.id as TimeFilter)}
                className={`px-5 py-2.5 rounded-xl text-xs font-bold whitespace-nowrap transition-colors ${timeFilter === tab.id ? "bg-foreground text-background shadow-md" : "bg-card border border-border text-muted-foreground hover:bg-muted"}`}
              >
                {tab.label}
              </button>
            ))}
          </div>
        </div>

        {/* ORDER TILES */}
        {filteredOrders.length === 0 ? (
          <div className="bg-card rounded-3xl border border-border p-12 text-center shadow-sm mt-4">
            <Package size={48} className="mx-auto text-muted-foreground/30 mb-4" />
            <h3 className="font-display text-xl font-bold text-foreground">No Orders Found</h3>
            <p className="text-muted-foreground text-sm mt-1">Try adjusting your time filter or search query.</p>
          </div>
        ) : (
          <div className="space-y-4">
            {filteredOrders.map((order) => {
              const productImages =
                order.order_items?.map((item: any) => item.product?.image_url).filter(Boolean) || [];
              const displayImages = productImages.slice(0, 3);
              const remainingImagesCount = productImages.length - displayImages.length;

              const needsReceipt =
                order.payment_status === "awaiting_receipt" ||
                (order.status === "submitted" && !order.payment_receipt_url);
              const isVerifying = order.payment_status === "under_review";

              return (
                <motion.div
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  key={order.id}
                  className={`bg-card rounded-2xl border ${needsReceipt ? "border-amber-300 shadow-amber-100" : "border-border"} p-4 shadow-sm hover:shadow-md transition-shadow relative`}
                >
                  {/* Top row: images + details */}
                  <div className="flex gap-4 items-start mb-3">
                    {/* Images */}
                    <div className="flex -space-x-3 shrink-0">
                      {displayImages.length > 0 ? (
                        displayImages.map((img: string, idx: number) => (
                          <div key={idx} className="w-12 h-12 rounded-full border-2 border-card bg-muted shadow-sm flex items-center justify-center overflow-hidden">
                            <img src={img} alt="Product" className="w-9 h-9 object-contain" />
                          </div>
                        ))
                      ) : (
                        <div className="w-12 h-12 rounded-full border-2 border-card bg-muted flex items-center justify-center">
                          <Package size={18} className="text-muted-foreground" />
                        </div>
                      )}
                      {remainingImagesCount > 0 && (
                        <div className="w-12 h-12 rounded-full border-2 border-card bg-muted text-xs flex items-center justify-center font-bold text-muted-foreground shadow-sm">
                          +{remainingImagesCount}
                        </div>
                      )}
                    </div>

                    {/* Order details */}
                    <div className="flex-1 min-w-0">
                      <div className="flex justify-between items-start mb-1">
                        <p className="text-xs font-bold text-muted-foreground uppercase tracking-widest">
                          Order #{order.id.split("-")[0]}
                        </p>
                        <p className="text-[10px] font-bold text-muted-foreground">{formatDate(order.created_at)}</p>
                      </div>
                      <p className="text-xl font-black text-foreground font-number">
                        {formatPrice(order.sales_order_value || 0)}
                      </p>

                      {/* Status Badges */}
                      <div className="flex flex-wrap gap-2 mt-1">
                        {needsReceipt ? (
                          <span className="bg-amber-100 text-amber-800 px-2.5 py-1 rounded-md text-[10px] font-bold uppercase flex items-center gap-1">
                            <AlertCircle size={12} />{" "}
                            {order.payment_rejection_reason ? "Payment rejected — upload receipt" : "Upload Receipt Required"}
                          </span>
                        ) : isVerifying ? (
                          <span className="bg-blue-50 text-blue-700 px-2.5 py-1 rounded-md text-[10px] font-bold uppercase flex items-center gap-1">
                            <Receipt size={12} /> Payment Verifying
                          </span>
                        ) : order.status === "delivered" ? (
                          <span className="bg-emerald-50 text-emerald-700 px-2.5 py-1 rounded-md text-[10px] font-bold uppercase flex items-center gap-1">
                            <CheckCircle2 size={12} /> Delivered
                          </span>
                        ) : order.status === "dispatched" ? (
                          <span className="bg-indigo-50 text-indigo-700 px-2.5 py-1 rounded-md text-[10px] font-bold uppercase flex items-center gap-1">
                            <Truck size={12} /> In Transit
                          </span>
                        ) : order.status === "cancelled" ? (
                          <span className="bg-muted text-muted-foreground px-2.5 py-1 rounded-md text-[10px] font-bold uppercase flex items-center gap-1">
                            <AlertCircle size={12} /> Cancelled
                          </span>
                        ) : (
                          <span className="bg-muted text-foreground px-2.5 py-1 rounded-md text-[10px] font-bold uppercase flex items-center gap-1">
                            <Package size={12} /> Processing
                          </span>
                        )}

                        <span className={`px-2.5 py-1 rounded-md text-[10px] font-bold uppercase flex items-center gap-1 border ${getDocStageStyle(order.document_stage)}`}>
                          {getDocStageLabel(order.document_stage)}
                        </span>
                      </div>

                      {needsReceipt && order.payment_rejection_reason ? (
                        <div className="mt-3 rounded-xl border border-destructive/25 bg-destructive/5 px-3 py-2.5 text-sm">
                          <p className="text-xs font-bold uppercase text-destructive tracking-wide">
                            Finance rejected this payment proof
                          </p>
                          <p className="text-foreground mt-1.5 whitespace-pre-wrap break-words">{order.payment_rejection_reason}</p>
                          <p className="text-xs text-muted-foreground mt-2 font-semibold">
                            Upload a corrected receipt using &quot;Upload Receipt&quot; below.
                          </p>
                        </div>
                      ) : null}
                    </div>
                  </div>

                  {/* 4-BUTTON MATRIX */}
                  <div className="grid grid-cols-2 gap-2 mt-3 pt-3 border-t border-border">
                    {/* 1. UPLOAD RECEIPT */}
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        setReceiptModal({ isOpen: true, orderId: order.id });
                      }}
                      disabled={!needsReceipt}
                      className={`py-2.5 px-3 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 transition-all ${
                        needsReceipt
                          ? "text-white shadow-md"
                          : "bg-muted text-muted-foreground cursor-not-allowed opacity-50"
                      }`}
                      style={needsReceipt ? { backgroundColor: GOLD } : {}}
                    >
                      <Upload size={14} /> Upload Receipt
                    </button>

                    {/* 2. DOWNLOAD SO/PI/Invoice */}
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleDownloadDocument(order);
                      }}
                      className="py-2.5 px-3 bg-card border border-border text-foreground rounded-xl text-xs font-bold hover:bg-muted flex items-center justify-center gap-1.5 transition-all"
                    >
                      <Download size={14} /> Download SO
                    </button>

                    {/* 3. REORDER */}
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        setReorderOrder(order);
                      }}
                      className="py-2.5 px-3 bg-card border border-border text-foreground rounded-xl text-xs font-bold hover:bg-muted flex items-center justify-center gap-1.5 transition-all"
                    >
                      <RotateCcw size={14} /> Reorder
                    </button>

                    {/* 4. TRACK STATUS */}
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        navigate(`/orders/${order.id}`);
                      }}
                      className="py-2.5 px-3 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 border-2 transition-all"
                      style={{ borderColor: GOLD, color: GOLD }}
                    >
                      <Truck size={14} /> Track Status
                    </button>
                  </div>

                  {/* Complaint Window */}
                  {order.status === "delivered" && (() => {
                    const dispatchDate = order.actual_despatch_date ? new Date(order.actual_despatch_date) : null;
                    if (!dispatchDate) return false;
                    const expiryDate = new Date(dispatchDate.getTime() + 10 * 24 * 60 * 60 * 1000);
                    return new Date() <= expiryDate;
                  })() && (
                    <button
                      onClick={(e) => { e.stopPropagation(); toast.info("Complaint form coming soon. Contact your account manager."); }}
                      className="w-full mt-2 py-2 bg-red-50 border border-red-200 text-red-700 rounded-xl text-xs font-bold hover:bg-red-100 flex items-center justify-center gap-1.5"
                    >
                      <AlertCircle size={14} /> Raise Complaint
                    </button>
                  )}
                </motion.div>
              );
            })}
          </div>
        )}
      </div>

      {/* UPLOAD RECEIPT MODAL */}
      {receiptModal.isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm">
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="bg-card rounded-3xl p-6 w-full max-w-sm shadow-2xl border border-border"
          >
            <div className="flex justify-between items-center mb-5">
              <h3 className="font-serif text-lg font-bold text-foreground">Upload Payment Receipt</h3>
              <button
                onClick={() => { setReceiptModal({ isOpen: false, orderId: null }); setReceiptFile(null); setReceiptRef(""); }}
                className="w-8 h-8 bg-muted rounded-full flex items-center justify-center text-muted-foreground hover:text-foreground"
              >✕</button>
            </div>

            <div className="space-y-4">
              <label className="bg-background p-5 border-2 border-dashed border-[#c58B07]/25 rounded-2xl flex flex-col items-center justify-center text-center cursor-pointer hover:border-[#c58B07]/50 transition-all relative">
                <input
                  type="file"
                  accept="image/*,.pdf"
                  className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                  onChange={(e) => setReceiptFile(e.target.files?.[0] || null)}
                />
                <Upload size={28} className={receiptFile ? "" : "text-muted-foreground"} style={receiptFile ? { color: GOLD } : {}} />
                <p className="text-sm font-bold text-foreground mt-2">{receiptFile ? receiptFile.name : "Tap to upload file"}</p>
                <p className="text-[10px] text-muted-foreground mt-1 uppercase tracking-wider">JPG, PNG, PDF</p>
              </label>

              <div>
                <label className="block text-[10px] font-bold text-muted-foreground uppercase tracking-widest mb-2">UTR / Bank Reference No.</label>
                <input
                  type="text"
                  placeholder="e.g., REF1234567890"
                  value={receiptRef}
                  onChange={(e) => setReceiptRef(e.target.value)}
                  className="w-full bg-muted border border-border rounded-xl p-3 text-sm font-bold text-foreground outline-none focus:border-[#c58B07] focus:ring-1 focus:ring-[#c58B07] transition-all placeholder:text-muted-foreground/50"
                />
              </div>
            </div>

            <button
              onClick={handleUploadReceipt}
              disabled={isUploadingReceipt || !receiptRef || !receiptFile}
              className="w-full mt-6 py-3.5 text-white font-bold rounded-xl flex justify-center items-center gap-2 shadow-lg disabled:opacity-50 transition-all text-sm"
              style={{ backgroundColor: GOLD }}
            >
              {isUploadingReceipt ? <Loader2 size={16} className="animate-spin" /> : "Submit for Verification"}
            </button>
          </motion.div>
        </div>
      )}

      <SmartReorderModal open={!!reorderOrder} onClose={() => setReorderOrder(null)} order={reorderOrder} />
    </AppShell>
  );
};

export default Orders;
