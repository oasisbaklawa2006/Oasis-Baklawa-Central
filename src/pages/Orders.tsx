import AppShell from "@/components/AppShell";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
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
    case "PI": return "Proforma Invoice (Awaiting Payment)";
    case "Final": return "Final Invoice Generated";
    default: return "Sales Order (Processing)";
  }
};

const getDocStageStyle = (stage: string | null) => {
  switch (stage) {
    case "PI": return "bg-orange-50 text-orange-700 border-orange-100";
    case "Final": return "bg-emerald-50 text-emerald-700 border-emerald-100";
    default: return "bg-indigo-50 text-indigo-700 border-indigo-100";
  }
};

const getDownloadLabel = (stage: string | null) => {
  switch (stage) {
    case "PI": return "Download PI";
    case "Final": return "Download Final Invoice";
    default: return "Download SO";
  }
};

type TimeFilter = "30days" | "6months" | "2026" | "all";

const Orders = () => {
  const [orders, setOrders] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [timeFilter, setTimeFilter] = useState<TimeFilter>("30days");
  const [searchQuery, setSearchQuery] = useState("");
  const [reorderOrder, setReorderOrder] = useState<any | null>(null);

  const fetchOrders = async () => {
    setLoading(true);
    // Fetching orders AND their nested items and product images
    const { data, error } = await supabase
      .from("orders")
    .select("id, status, created_at, sales_order_value, document_stage, payment_cleared, eway_bill_number, order_items(*, product:products(name, image_url, pack_size, carton_type, wholesale_price, mrp, price_per_kg))")
    .neq("status", "draft")
      .order("created_at", { ascending: false });

    if (!error && data) setOrders(data);
    setLoading(false);
  };

  useEffect(() => {
    fetchOrders();
  }, []);

  // Filter Logic
  const filteredOrders = orders.filter((order) => {
    // 1. Search Filter
    const matchesSearch = order.id.toLowerCase().includes(searchQuery.toLowerCase());

    // 2. Time Filter
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
              // Extract Product Images for the overlapping cluster
              const productImages =
                order.order_items?.map((item: any) => item.product?.image_url).filter(Boolean) || [];
              const displayImages = productImages.slice(0, 3);
              const remainingImagesCount = productImages.length - displayImages.length;

              // MOCK ISSUE STATUS (In reality, derived from a support_tickets table)
              // We'll randomly assign a mock issue to older orders just to show you the UI
              const hasIssue = order.status === "cancelled" || Math.random() > 0.85;

              return (
                <motion.div
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  key={order.id}
                  className="bg-white rounded-2xl border border-slate-200 p-5 shadow-sm hover:shadow-md transition-shadow"
                >
                  <div className="flex flex-col md:flex-row gap-5 items-start md:items-center">
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
                      <p className="text-xl font-black text-slate-900 mb-2">
                        {formatPrice(order.sales_order_value || 0)}
                      </p>

                      {/* Status Badges */}
                      <div className="flex flex-wrap gap-2">
                        {/* Delivery Status */}
                        {order.status === "delivered" ? (
                          <span className="bg-emerald-50 text-emerald-700 px-2.5 py-1 rounded-md text-[10px] font-bold uppercase flex items-center gap-1">
                            <CheckCircle2 size={12} /> Delivered
                          </span>
                        ) : order.status === "dispatched" ? (
                          <span className="bg-blue-50 text-blue-700 px-2.5 py-1 rounded-md text-[10px] font-bold uppercase flex items-center gap-1">
                            <Truck size={12} /> In Transit
                          </span>
                        ) : order.status === "cancelled" ? (
                          <span className="bg-slate-100 text-slate-600 px-2.5 py-1 rounded-md text-[10px] font-bold uppercase flex items-center gap-1">
                            <AlertCircle size={12} /> Cancelled
                          </span>
                        ) : (
                          <span className="bg-amber-50 text-amber-700 px-2.5 py-1 rounded-md text-[10px] font-bold uppercase flex items-center gap-1">
                            <Package size={12} /> Processing
                          </span>
                        )}

                        {/* Document Stage Badge */}
                        <span className={`px-2.5 py-1 rounded-md text-[10px] font-bold uppercase flex items-center gap-1 border ${getDocStageStyle(order.document_stage)}`}>
                          {getDocStageLabel(order.document_stage)}
                        </span>

                        {/* Issue Tracking Tag */}
                        {hasIssue ? (
                          <span className="bg-rose-50 text-rose-600 px-2.5 py-1 rounded-md text-[10px] font-bold uppercase flex items-center gap-1 border border-rose-100">
                            <Ticket size={12} /> Issue Raised
                          </span>
                        ) : (
                          <span className="bg-slate-50 text-slate-500 px-2.5 py-1 rounded-md text-[10px] font-bold uppercase flex items-center gap-1 border border-slate-100">
                            <CheckCircle2 size={12} /> No Issues
                          </span>
                        )}
                      </div>

                      {/* E-Way Bill */}
                      {order.eway_bill_number && (
                        <p className="text-[10px] font-bold text-slate-500 mt-2">
                          E-Way Bill: <span className="text-slate-800">{order.eway_bill_number}</span>
                        </p>
                      )}
                    </div>

                    {/* RIGHT/BOTTOM: Actions */}
                    <div className="flex w-full md:w-auto md:flex-col gap-2 shrink-0 border-t border-border md:border-none pt-4 md:pt-0 mt-2 md:mt-0">
                      <button
                        onClick={() => setReorderOrder(order)}
                        className="flex-1 md:w-full py-2.5 px-4 bg-primary text-primary-foreground rounded-xl text-xs font-bold hover:opacity-90 flex items-center justify-center gap-1.5 shadow-sm"
                      >
                        <RotateCcw size={14} /> Reorder
                      </button>
                      <button
                        onClick={() => toast.info(`Downloading ${order.document_stage === "PI" ? "PI" : order.document_stage === "Final" ? "Final Invoice" : "SO"}...`)}
                        className="flex-1 md:w-full py-2.5 px-4 bg-card border border-border text-foreground rounded-xl text-xs font-bold hover:bg-muted flex items-center justify-center gap-1.5 shadow-sm"
                      >
                        <Download size={14} /> {getDownloadLabel(order.document_stage)}
                      </button>
                      <button
                        onClick={() => toast.info("Opening order details...")}
                        className="flex-1 md:w-full py-2.5 px-4 bg-foreground text-background rounded-xl text-xs font-bold hover:opacity-90 flex items-center justify-center gap-1.5 shadow-sm"
                      >
                        View Details <ChevronRight size={14} />
                      </button>
                    </div>
                  </div>
                </motion.div>
              );
            })}
          </div>
        )}
      </div>

      <SmartReorderModal
        open={!!reorderOrder}
        onClose={() => setReorderOrder(null)}
        order={reorderOrder}
      />
    </AppShell>
  );
};

export default Orders;
