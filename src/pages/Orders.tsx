import AppShell from "@/components/AppShell";
import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { generateSOPdf } from "@/utils/soGenerator";
import {
  Loader2,
  Package,
  Search,
  Download,
  ChevronRight,
  AlertCircle,
  CheckCircle2,
  Ticket,
  Truck,
  RotateCcw,
  Upload,
  Receipt,
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { toast } from "sonner";
import SmartReorderModal from "@/components/SmartReorderModal";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";

const formatPrice = (n: number) => "₹" + n.toLocaleString("en-IN");
const formatDate = (dateString: string) =>
  new Date(dateString).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" });

const getDocStageLabel = (stage: string | null) => {
  switch (stage) {
    case "PI":
      return "Proforma Invoice";
    case "Final":
      return "Final Invoice Generated";
    default:
      return "Sales Order";
  }
};

const getDocStageStyle = (stage: string | null) => {
  switch (stage) {
    case "PI":
      return "bg-orange-50 text-orange-700 border-orange-100";
    case "Final":
      return "bg-emerald-50 text-emerald-700 border-emerald-100";
    default:
      return "bg-indigo-50 text-indigo-700 border-indigo-100";
  }
};

const getDownloadLabel = (stage: string | null) => {
  switch (stage) {
    case "PI":
      return "Download PI";
    case "Final":
      return "Download Final Invoice";
    default:
      return "Download SO";
  }
};

type TimeFilter = "30days" | "6months" | "2026" | "all";

const Orders = () => {
  const navigate = useNavigate();
  const [orders, setOrders] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploadingId, setUploadingId] = useState<string | null>(null);
  const [timeFilter, setTimeFilter] = useState<TimeFilter>("30days");
  const [searchQuery, setSearchQuery] = useState("");
  const [reorderOrder, setReorderOrder] = useState<any | null>(null);

  const fetchOrders = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("orders")
      .select(
        "id, status, payment_status, payment_receipt_url, created_at, actual_despatch_date, sales_order_value, document_stage, payment_cleared, eway_bill_number, proforma_invoice_url, final_invoice_url, eway_bill_url, company:companies(business_name, gst_number), order_items(*, product:products(name, image_url, pack_size, carton_type, wholesale_price, mrp, price_per_kg, price_b2b, base_price, avg_weight_per_pack, net_weight_grams, gst_percentage, hsn_code, uom, category, sub_category, moq, packs_per_master_carton, pcs_per_master_carton))",
      )
      .in("status", ["submitted", "pending", "processing", "dispatched", "delivered", "cancelled"])
      .order("created_at", { ascending: false });

    if (!error && data) setOrders(data);
    setLoading(false);
  };

  useEffect(() => {
    fetchOrders();
  }, []);

  const handleDownloadDocument = (order: any) => {
    const stage = order.document_stage;
    if (stage === "Final") {
      if (order.final_invoice_url) {
        window.open(order.final_invoice_url, "_blank");
      } else {
        toast.info("Final Invoice is being prepared by the accounts team.");
      }
      return;
    }
    if (stage === "PI") {
      if (order.proforma_invoice_url) {
        window.open(order.proforma_invoice_url, "_blank");
      } else {
        toast.info("Proforma Invoice is being prepared by the accounts team.");
      }
      return;
    }
    generateSOPdf(order);
  };

  const handleFileUpload = async (orderId: string, file: File) => {
    try {
      setUploadingId(orderId);
      const fileExt = file.name.split(".").pop();
      const fileName = `${orderId}-${Date.now()}.${fileExt}`;

      // 1. Upload to Supabase Storage
      const { data: uploadData, error: uploadError } = await supabase.storage.from("receipts").upload(fileName, file);

      if (uploadError) throw uploadError;

      // 2. Get Public URL
      const {
        data: { publicUrl },
      } = supabase.storage.from("receipts").getPublicUrl(fileName);

      // 3. Update Order Record
      const { error: updateError } = await supabase
        .from("orders")
        .update({
          payment_receipt_url: publicUrl,
          payment_status: "under_review",
        })
        .eq("id", orderId);

      if (updateError) throw updateError;

      toast.success("Payment receipt uploaded successfully! Verifying now.");
      fetchOrders(); // Refresh to update UI
    } catch (error: any) {
      console.error("Upload error:", error);
      toast.error(error.message || "Failed to upload receipt. Please try again.");
    } finally {
      setUploadingId(null);
    }
  };

  // Filter Logic
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
          <Loader2 size={32} className="animate-spin text-[#B8860B]" />
          <p className="mt-4 text-slate-500 font-bold text-xs uppercase tracking-widest">Loading Ledger...</p>
        </div>
      </AppShell>
    );

  return (
    <AppShell>
      <div className="max-w-4xl mx-auto pb-24 px-4 sm:px-6 space-y-6">
        {/* HEADER */}
        <div>
          <h1 className="font-display text-3xl font-bold text-slate-900">Order History</h1>
          <p className="text-sm font-bold text-slate-500 mt-1">
            Review past shipments, download invoices, and track issues.
          </p>
        </div>

        {/* SEARCH & TABS */}
        <div className="space-y-4 sticky top-0 z-10 bg-slate-50 pt-2 pb-4">
          <div className="relative bg-white rounded-2xl shadow-sm border border-slate-200 p-2 flex items-center">
            <Search size={18} className="text-slate-400 ml-3" />
            <input
              type="text"
              placeholder="Search by Order ID..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full bg-transparent border-none focus:ring-0 text-sm font-bold px-3 py-2 outline-none text-slate-900"
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
                className={`px-5 py-2.5 rounded-xl text-xs font-bold whitespace-nowrap transition-colors ${timeFilter === tab.id ? "bg-slate-900 text-white shadow-md" : "bg-white border border-slate-200 text-slate-600 hover:bg-slate-100"}`}
              >
                {tab.label}
              </button>
            ))}
          </div>
        </div>

        {/* ORDER TILES */}
        {filteredOrders.length === 0 ? (
          <div className="bg-white rounded-3xl border border-slate-200 p-12 text-center shadow-sm mt-4">
            <Package size={48} className="mx-auto text-slate-300 mb-4" />
            <h3 className="font-display text-xl font-bold text-slate-900">No Orders Found</h3>
            <p className="text-slate-500 text-sm mt-1">Try adjusting your time filter or search query.</p>
          </div>
        ) : (
          <div className="space-y-4">
            {filteredOrders.map((order) => {
              const productImages =
                order.order_items?.map((item: any) => item.product?.image_url).filter(Boolean) || [];
              const displayImages = productImages.slice(0, 3);
              const remainingImagesCount = productImages.length - displayImages.length;

              const hasIssue = order.status === "cancelled";

              // UTR Logic flags
              const needsReceipt =
                order.payment_status === "awaiting_receipt" ||
                (order.status === "submitted" && !order.payment_receipt_url);
              const isVerifying = order.payment_status === "under_review";

              return (
                <motion.div
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  key={order.id}
                  className={`bg-white rounded-2xl border ${needsReceipt ? "border-amber-300 shadow-amber-100" : "border-slate-200"} p-5 shadow-sm hover:shadow-md transition-shadow relative cursor-pointer`}
                  onClick={() => navigate(`/orders/${order.id}`)}
                >
                  {/* Top-right Reorder shortcut */}
                  <button
                    onClick={() => setReorderOrder(order)}
                    className="absolute top-3 right-3 p-2 rounded-lg bg-primary/10 text-primary hover:bg-primary/20 transition-colors"
                    title="Smart Reorder"
                  >
                    <RotateCcw size={16} />
                  </button>

                  <div className="flex flex-col md:flex-row gap-5 items-start md:items-center pr-10">
                    {/* LEFT: Overlapping Images Cluster */}
                    <div className="flex -space-x-3 shrink-0">
                      {displayImages.length > 0 ? (
                        displayImages.map((img: string, idx: number) => (
                          <div
                            key={idx}
                            className="w-14 h-14 rounded-full border-2 border-white bg-slate-50 shadow-sm flex items-center justify-center overflow-hidden relative z-10"
                          >
                            <img src={img} alt="Product" className="w-10 h-10 object-contain" />
                          </div>
                        ))
                      ) : (
                        <div className="w-14 h-14 rounded-full border-2 border-white bg-slate-100 flex items-center justify-center">
                          <Package size={20} className="text-slate-300" />
                        </div>
                      )}
                      {remainingImagesCount > 0 && (
                        <div className="w-14 h-14 rounded-full border-2 border-white bg-slate-100 text-xs flex items-center justify-center font-bold text-slate-600 shadow-sm relative z-0">
                          +{remainingImagesCount}
                        </div>
                      )}
                    </div>

                    {/* MIDDLE: Order Core Details */}
                    <div className="flex-1 min-w-0 w-full">
                      <div className="flex justify-between items-start mb-1">
                        <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">
                          Order #{order.id.split("-")[0]}
                        </p>
                        <p className="text-[10px] font-bold text-slate-400">{formatDate(order.created_at)}</p>
                      </div>
                      <p className="text-xl font-black text-slate-900" style={{ fontFamily: "'DM Sans', sans-serif" }}>
                        {formatPrice(order.sales_order_value || 0)}
                      </p>

                      {/* Status Badges */}
                      <div className="flex flex-wrap gap-2">
                        {/* Custom Payment Badge (Overrides normal processing if payment is pending) */}
                        {needsReceipt ? (
                          <span className="bg-amber-100 text-amber-800 px-2.5 py-1 rounded-md text-[10px] font-bold uppercase flex items-center gap-1">
                            <AlertCircle size={12} /> Action Required: Upload UTR
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
                          <span className="bg-slate-100 text-slate-600 px-2.5 py-1 rounded-md text-[10px] font-bold uppercase flex items-center gap-1">
                            <AlertCircle size={12} /> Cancelled
                          </span>
                        ) : (
                          <span className="bg-slate-50 text-slate-700 px-2.5 py-1 rounded-md text-[10px] font-bold uppercase flex items-center gap-1">
                            <Package size={12} /> Processing
                          </span>
                        )}

                        {/* Document Stage Badge */}
                        <span
                          className={`px-2.5 py-1 rounded-md text-[10px] font-bold uppercase flex items-center gap-1 border ${getDocStageStyle(order.document_stage)}`}
                        >
                          {getDocStageLabel(order.document_stage)}
                        </span>
                      </div>
                    </div>

                    {/* RIGHT/BOTTOM: Actions */}
                    <div className="flex flex-wrap w-full md:w-auto md:flex-col gap-2 shrink-0 border-t border-border md:border-none pt-4 md:pt-0 mt-2 md:mt-0">
                      {/* NEW: UPLOAD RECEIPT BUTTON */}
                      {needsReceipt ? (
                        <label
                          className={`flex-1 md:w-full py-2.5 px-4 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 shadow-sm cursor-pointer transition-all ${uploadingId === order.id ? "bg-slate-200 text-slate-500" : "bg-gradient-to-r from-[#D4AF37] to-[#F3E5AB] text-[#005F5F] hover:brightness-105"}`}
                        >
                          {uploadingId === order.id ? (
                            <>
                              <Loader2 size={14} className="animate-spin" /> Uploading...
                            </>
                          ) : (
                            <>
                              <Upload size={14} /> Upload Receipt
                            </>
                          )}
                          <input
                            type="file"
                            accept="image/*,.pdf"
                            className="hidden"
                            onChange={(e) => {
                              if (e.target.files && e.target.files[0]) {
                                handleFileUpload(order.id, e.target.files[0]);
                              }
                            }}
                            disabled={uploadingId === order.id}
                          />
                        </label>
                      ) : (
                        <button
                          onClick={() => setReorderOrder(order)}
                          className="flex-1 md:w-full py-2.5 px-4 bg-primary text-primary-foreground rounded-xl text-xs font-bold hover:opacity-90 flex items-center justify-center gap-1.5 shadow-sm"
                        >
                          <RotateCcw size={14} /> Reorder
                        </button>
                      )}

                      <button
                        onClick={() => handleDownloadDocument(order)}
                        className="flex-1 md:w-full py-2.5 px-4 bg-card border border-border text-foreground rounded-xl text-xs font-bold hover:bg-muted flex items-center justify-center gap-1.5 shadow-sm"
                      >
                        <Download size={14} /> {getDownloadLabel(order.document_stage)}
                      </button>

                      {/* Conditional Document Buttons */}
                      {order.proforma_invoice_url && (
                        <a
                          href={order.proforma_invoice_url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="flex-1 md:w-full py-2.5 px-4 bg-card border border-border text-foreground rounded-xl text-xs font-bold hover:bg-muted flex items-center justify-center gap-1.5 shadow-sm"
                        >
                          <Receipt size={14} /> Download PI
                        </a>
                      )}
                      {order.final_invoice_url && (
                        <a
                          href={order.final_invoice_url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="flex-1 md:w-full py-2.5 px-4 bg-card border border-border text-foreground rounded-xl text-xs font-bold hover:bg-muted flex items-center justify-center gap-1.5 shadow-sm"
                        >
                          <Receipt size={14} /> Tax Invoice
                        </a>
                      )}
                      {order.eway_bill_url && (
                        <a
                          href={order.eway_bill_url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="flex-1 md:w-full py-2.5 px-4 bg-card border border-border text-foreground rounded-xl text-xs font-bold hover:bg-muted flex items-center justify-center gap-1.5 shadow-sm"
                        >
                          <Truck size={14} /> E-Way Bill
                        </a>
                      )}
                    </div>
                  </div>
                </motion.div>
              );
            })}
          </div>
        )}
      </div>

      <SmartReorderModal open={!!reorderOrder} onClose={() => setReorderOrder(null)} order={reorderOrder} />
    </AppShell>
  );
};

export default Orders;
